import { TestExecutionError, TestTimeoutError } from '../../errors';
import {
  TestScenario,
  TestScenarioResult,
  RetryConfig,
  TestResultSchema,
  TestResult,
} from './types';
import { generateScenarioPrompt } from './parser';
import { isTransientError, calculateBackoffDelay, sleep } from './utils';
import {
  UnifiedLLMClient,
  type InternalMessage,
} from '../../utils/tool-enabled-llm/unified-client.js';
import { createCommandExecutionTool } from './tools';
import { BaseModelProvider, retryWithBackoff } from '../../providers/base';
import { generateRules } from '../../vibe-rules';
import { TestEnvironmentManager } from './environment';
import { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { realpath } from 'fs/promises';

// Replace the existing JSON response instructions with the new simplified schema
const jsonResponseInstructions = `
Return a JSON object with the following fields:
- id: string (unique identifier for the test scenario)
- status: "PASS" or "FAIL"
- summary: string (brief description of the outcome, including key messages or error information)
- executionTime: number (time taken to execute the scenario in seconds)
- error: string (optional, provide if there is an error)

Example:
\`\`\`json
{
  "id": "scenario-1",
  "status": "PASS",
  "summary": "Test completed successfully",
  "executionTime": 2.5,
  "error": null
}
\`\`\`
`;
/**
 * Summarize an LLM conversation to extract the approach taken
 */
async function summarizeLLMConversationForApproach(
  messages: InternalMessage[],
  taskDescription: string,
  executionHistory: Array<{ tool: string; args: any; result: any }>,
  provider: BaseModelProvider,
  debug: boolean
): Promise<string> {
  const model = 'gemini-2.5-pro-exp-03-25';

  // Convert messages to text format
  const conversationText = messages
    .map(
      (msg) =>
        `${msg.role}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`
    )
    .join('\n');

  // Format tool executions
  const toolExecutionsText = executionHistory
    .map((exec, index) => {
      const success = exec.result.success ? '✅' : '❌';
      return `Tool Call ${index + 1}: ${success} ${exec.tool}
Arguments: ${JSON.stringify(exec.args)}
Output: ${exec.result.output}${exec.result.error ? `\nError: ${JSON.stringify(exec.result.error)}` : ''}
---`;
    })
    .join('\n');

  const prompt = `
Summarize the following LLM conversation and tool executions to extract a concise description of the approach taken by the assistant.
Focus on the key steps, tools used, and overall strategy.

Original Task Description: ${taskDescription}

Tool Executions:
\`\`\`
${toolExecutionsText}
\`\`\`

LLM Conversation:
\`\`\`
${conversationText}
\`\`\`

Provide a summary of the approach taken by the assistant in 1-2 concise paragraphs.
Focus on the high-level strategy, key actions, and results of tool executions.
Include both successful and failed tool calls in your summary.`;

  if (debug) {
    console.log('Summarization Prompt:\n', prompt);
  }

  try {
    const summaryResponse = await provider.executePrompt(prompt, {
      model,
      maxTokens: 1000,
      debug,
      systemPrompt:
        'You are an expert at summarizing complex conversations and tool executions concisely and extracting key information.',
    });

    if (debug) {
      console.log('Summarization Response:\n', summaryResponse);
    }

    return summaryResponse.trim();
  } catch (error) {
    console.error('Error summarizing LLM conversation:', error);
    return `Error summarizing conversation: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Execute a test scenario using the unified LLM client
 * This approach actually executes commands for real testing
 *
 * @param scenario - The test scenario to execute
 * @param options - Execution options
 * @returns Test scenario result
 */
export async function executeScenario(
  scenario: TestScenario,
  options: {
    model: string;
    provider: 'anthropic' | 'openrouter';
    timeout: number;
    retryConfig: RetryConfig;
    debug: boolean;
    mcpServers?: string[]; // Optional MCP servers to include
    scenarioId: string; // Add scenarioId to options
    outputBuffer?: string[]; // Add outputBuffer parameter
  },
  geminiProvider: BaseModelProvider // used for summarization
): Promise<TestScenarioResult> {
  // Declare filesystemClient at the function scope so it's available in the finally block
  let filesystemClient: Client | undefined;
  const { model, provider, timeout, retryConfig, debug, scenarioId, outputBuffer = [] } = options;
  // Note: mcpServers is not used currently but kept for future implementation
  const startTime = Date.now();
  let attempts = 0;

  // Helper function to append to buffer and optionally log to console
  const appendToBuffer = (text: string, shouldPrefix: boolean = true) => {
    if (outputBuffer) {
      if (shouldPrefix) {
        outputBuffer.push(`[${new Date().toISOString()}] ${text}`);
      } else {
        outputBuffer.push(text);
      }
    }
    if (debug) {
      console.log(text);
    }
  };

  // Create a temporary directory for this test scenario
  const tempDir = await TestEnvironmentManager.createTempDirectory(scenarioId);
  appendToBuffer(`Created temporary directory: ${tempDir}`);

  // Copy assets and update task description with new references
  const modifiedTaskDescription = await TestEnvironmentManager.copyAssets(scenario, tempDir, debug);
  // Log the modified task description if in debug mode
  if (debug) {
    appendToBuffer(`Original task description: ${scenario.taskDescription}`);
    appendToBuffer(`Modified task description: ${modifiedTaskDescription}`);
  }

  // Extract environment overrides from the task description
  const envOverrides = TestEnvironmentManager.extractEnvOverrides(scenario.taskDescription);
  if (debug && Object.keys(envOverrides).length > 0) {
    appendToBuffer(`Environment overrides: ${JSON.stringify(envOverrides)}`);
  }

  // Create a modified scenario with updated task description
  const modifiedScenario = {
    ...scenario,
    taskDescription: modifiedTaskDescription,
  };

  try {
    while (attempts < retryConfig.retries) {
      attempts++;
      try {
        // Check if timeout has been exceeded
        if ((Date.now() - startTime) / 1000 > timeout) {
          throw new TestTimeoutError(scenarioId, timeout);
        }

        const tempDirRealPath = await realpath(tempDir);
        const allowedPaths = tempDir === tempDirRealPath ? [tempDir] : [tempDir, tempDirRealPath];
        // Initialize filesystem MCP client
        const filesystemMCPConfig: StdioServerParameters = {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', ...allowedPaths],
        };

        // Create tool definitions
        const tools = [
          createCommandExecutionTool({
            debug,
            cwd: tempDir,
            scenarioId,
            env: envOverrides,
            appendToBuffer,
          }),
        ];

        // Generate initial prompt using the modified scenario
        const prompt = generateScenarioPrompt(modifiedScenario);

        // Process the query with tools
        const systemPrompt = `You are a testing agent for vibe-tools commands. Your task is to execute the test scenario provided using the tools available to determine if vibe-tools is working correctly and report the results.

<filesystem_mcp_tool>
A filesystem MCP tool (filesystem_mcp) is available for file operations. This tool is configured via '@modelcontextprotocol/server-filesystem' and can ONLY access the temporary test directory (${tempDir}).

The filesystem_mcp tool supports the following operations:
- read: Read the contents of a file
- write: Write content to a file
- list: List files in a directory
- exists: Check if a file or directory exists
- mkdir: Create a directory

Examples:
- To read a file: filesystem_mcp({ operation: 'read', path: 'example.txt' })
- To write to a file: filesystem_mcp({ operation: 'write', path: 'example.txt', content: 'Hello world' })
- To list files: filesystem_mcp({ operation: 'list', path: '.' })

IMPORTANT: Do NOT attempt to use this tool to access files outside the temporary test directory (your current working directory).
</filesystem_mcp_tool>

${generateRules('cursor')}

Execute the test scenario provided and report the results. If you run into problems executing the scenario, make 3 attempts to execute the scenario. If you are still run into problems after 3 attempts, report the results as FAIL.

<hints>
You have access to a filesystem tool that can read and write files, list directores etc. in the temporary test directory.
The available command line tools are vibe-tools and ${tools.map((tool) => tool.name).join(', ')}. Other command line tools are not permitted.
Reply to the chat with your workings and your findings. Only use tools to perform the test, do not use tools to communicate your results.
</hints>

Update me on what you are doing as you execute the test scenario. Once you determine that it's passed or failed, report the results in the following format:
${jsonResponseInstructions}
`;

        // Create LLM client with non-prefixed logger for model outputs
        const client = new UnifiedLLMClient(
          {
            provider,
            model,
            debug,
            maxTokens: 8192,
            logger: (text) => appendToBuffer(text, false), // Don't prefix LLM outputs
            mcpMode: true,
            mcpConfig: filesystemMCPConfig,
          },
          tools
        );
        await client.startMCP();
        // Execute with timeout
        const messages = await Promise.race([
          client.processQuery(prompt, systemPrompt),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new TestTimeoutError(scenarioId, timeout)), timeout * 1000);
          }),
        ]);

        // Extract the final result message
        const finalMessage = messages[messages.length - 1];

        // Get the tool execution history for detailed reporting
        const executionHistory = client.getExecutionHistory();

        // Parse the response JSON using the new simplified schema
        let jsonContent = '';
        let parsedResponse: TestResult;

        // convert array content to string
        if (Array.isArray(finalMessage.content)) {
          finalMessage.content = finalMessage.content
            .flatMap((content) => {
              if (typeof content === 'string') {
                return content;
              }
              if (content.type === 'text') {
                return content.text;
              }
              return JSON.stringify(content);
            })
            .join('\n');
        }

        if (typeof finalMessage.content === 'string') {
          const jsonMatch = finalMessage.content.match(/```json([\s\S]*?)```/);
          if (!jsonMatch) {
            throw new TestExecutionError(
              `Failed to parse JSON response from AI agent: ${finalMessage.content}...`
            );
          }
          jsonContent = jsonMatch[1].trim();
        } else {
          console.log('finalMessage', JSON.stringify(finalMessage, null, 2));
          throw new TestExecutionError(
            'Expected final message to contain a string with JSON, but received a complex message type'
          );
        }

        try {
          parsedResponse = TestResultSchema.parse(JSON.parse(jsonContent));
        } catch (error: unknown) {
          throw new TestExecutionError(
            `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}. Raw content: ${jsonContent.substring(0, 200)}...`
          );
        }

        // Get the approach summary using Gemini
        const approachTaken = await retryWithBackoff(
          () =>
            summarizeLLMConversationForApproach(
              messages,
              modifiedScenario.taskDescription,
              executionHistory,
              geminiProvider,
              debug
            ),
          2,
          1000,
          () => true
        );

        // Return the test result
        return {
          id: scenarioId,
          type: scenario.type,
          description: scenario.description,
          taskDescription: scenario.taskDescription,
          approachTaken,
          commands: [],
          actualCommands: executionHistory.map((h) => h.args.command),
          output: parsedResponse.summary,
          outputBuffer,
          toolExecutions: executionHistory,
          expectedBehavior: [],
          successCriteria: [],
          result: parsedResponse.status,
          executionTime: parsedResponse.executionTime,
          attempts,
          explanation: parsedResponse.error || parsedResponse.summary,
        };
      } catch (error) {
        console.error(`Error on attempt ${attempts}:`, error);

        // If this is a timeout error, stop retrying immediately
        if (error instanceof TestTimeoutError) {
          return {
            id: scenarioId,
            type: scenario.type,
            description: scenario.description,
            taskDescription: scenario.taskDescription,
            approachTaken: 'Unable to determine approach due to timeout',
            commands: [],
            actualCommands: [],
            output: `Test execution timed out after ${timeout} seconds`,
            outputBuffer,
            toolExecutions: [],
            expectedBehavior: [],
            successCriteria: [],
            result: 'FAIL',
            executionTime: timeout,
            attempts,
            explanation: `Test execution timed out after ${timeout} seconds`,
          };
        }

        // For transient errors, retry after a delay
        if (isTransientError(error) && attempts < retryConfig.retries) {
          const delay = calculateBackoffDelay(attempts, retryConfig);
          console.log(`Retrying after ${delay}ms delay...`);
          await sleep(delay);
          continue;
        }

        // If we've reached max retries or the error is not transient, return failure
        return {
          id: scenarioId,
          type: scenario.type,
          description: scenario.description,
          taskDescription: scenario.taskDescription,
          approachTaken: 'Unable to determine approach due to error',
          commands: [],
          actualCommands: [],
          output: `Error: ${error instanceof Error ? error.message : String(error)}`,
          outputBuffer,
          toolExecutions: [],
          expectedBehavior: scenario.expectedBehavior.map((behavior) => ({
            behavior,
            met: false,
            explanation: `Failed due to error: ${error instanceof Error ? error.message : String(error)}`,
          })),
          successCriteria: scenario.successCriteria.map((criteria) => ({
            criteria,
            met: false,
            explanation: `Failed due to error: ${error instanceof Error ? error.message : String(error)}`,
          })),
          result: 'FAIL',
          executionTime: (Date.now() - startTime) / 1000,
          attempts,
          explanation: `Error: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // Should never reach here due to the loop and error handling above
    return {
      id: scenarioId,
      type: scenario.type,
      description: scenario.description,
      taskDescription: scenario.taskDescription,
      approachTaken: 'Unable to determine approach after maximum retries',
      commands: [],
      actualCommands: [],
      output: 'Exceeded maximum number of retries',
      outputBuffer,
      toolExecutions: [],
      expectedBehavior: scenario.expectedBehavior.map((behavior) => ({
        behavior,
        met: false,
        explanation: 'Failed: Exceeded maximum number of retries',
      })),
      successCriteria: scenario.successCriteria.map((criteria) => ({
        criteria,
        met: false,
        explanation: 'Failed: Exceeded maximum number of retries',
      })),
      result: 'FAIL',
      executionTime: (Date.now() - startTime) / 1000,
      attempts,
      explanation: 'Exceeded maximum number of retries',
    };
  } catch (error) {
    console.error('Fatal error in execute scenario:', error);
    return {
      id: scenarioId,
      type: scenario.type,
      description: scenario.description,
      taskDescription: scenario.taskDescription,
      approachTaken: 'Unable to determine approach due to fatal error',
      commands: [],
      actualCommands: [],
      output: `Fatal error: ${error instanceof Error ? error.message : String(error)}`,
      outputBuffer,
      toolExecutions: [],
      expectedBehavior: scenario.expectedBehavior.map((behavior) => ({
        behavior,
        met: false,
        explanation: `Failed due to fatal error: ${error instanceof Error ? error.message : String(error)}`,
      })),
      successCriteria: scenario.successCriteria.map((criteria) => ({
        criteria,
        met: false,
        explanation: `Failed due to fatal error: ${error instanceof Error ? error.message : String(error)}`,
      })),
      result: 'FAIL',
      executionTime: (Date.now() - startTime) / 1000,
      attempts,
      explanation: `Fatal error: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    // Clean up resources
    try {
      // Stop the filesystem MCP client if it exists
      if (filesystemClient) {
        await filesystemClient.close();
        if (debug) {
          console.log(`Stopped filesystem MCP client`);
        }
      }

      // Clean up temporary directory
      await TestEnvironmentManager.cleanup(tempDir);
      if (debug) {
        console.log(`Cleaned up temporary directory: ${tempDir}`);
      }
    } catch (error) {
      console.error(`Error cleaning up resources: ${error}`);
    }
  }
}
