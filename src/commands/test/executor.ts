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
import { ToolEnabledLLMClient } from '../../utils/tool-enabled-llm/client';
import { createCommandExecutionTool } from './tools';
import { BaseModelProvider } from '../../providers/base';
import type { InternalMessage } from '../../utils/tool-enabled-llm/client';
import { CURSOR_RULES_TEMPLATE } from '../../cursorrules';
import { TestEnvironmentManager } from './environment';

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
  const model = 'gemini-2.0-flash-thinking-exp-01-21';

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
 * Execute a test scenario using the tool-enabled LLM client
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
    timeout: number;
    retryConfig: RetryConfig;
    debug: boolean;
    mcpServers?: string[]; // Optional MCP servers to include
    scenarioId: string; // Add scenarioId to options
    outputBuffer?: string[]; // Add outputBuffer parameter
  },
  geminiProvider: BaseModelProvider // used for summarization
): Promise<TestScenarioResult> {
  const { model, timeout, retryConfig, debug, scenarioId, outputBuffer = [] } = options;
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
  const modifiedTaskDescription = await TestEnvironmentManager.copyAssets(scenario, tempDir);

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

        // Determine API key (this should be properly managed elsewhere)
        const apiKey = process.env.ANTHROPIC_API_KEY || '';
        if (!apiKey) {
          throw new TestExecutionError(
            'ANTHROPIC_API_KEY not found in environment. Required for tool-enabled testing.'
          );
        }

        // Create LLM client with non-prefixed logger for model outputs
        const client = new ToolEnabledLLMClient(
          apiKey,
          {
            model,
            debug,
            maxTokens: 8192,
            logger: (text) => appendToBuffer(text, false), // Don't prefix LLM outputs
          },
          tools
        );

        // Generate initial prompt using the modified scenario
        const prompt = generateScenarioPrompt(modifiedScenario);

        // Process the query with tools
        const systemPrompt = `You are a testing agent for cursor-tools commands. Your task is to execute the test scenario provided using the tools available to determine if cursor-tools is working correctly and report the results.

${CURSOR_RULES_TEMPLATE}

Execute the test scenario provided and report the results. If you run into problems executing the scenario, make 3 attempts to execute the scenario. If you are still run into problems after 3 attempts, report the results as FAIL.

<hints>
The available command line tools are cursor-tools and ${tools.map((tool) => tool.name).join(', ')}. Other command line tools are not permitted.
Reply to the chat with your workings and your findings. Only use tools to perform the test, do not use tools to communicate your results.
</hints>
`;

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

        if (typeof finalMessage.content === 'string') {
          const jsonMatch = finalMessage.content.match(/```json([\s\S]*?)```/);
          if (!jsonMatch) {
            throw new TestExecutionError(
              `Failed to parse JSON response from AI agent: ${finalMessage.content.substring(0, 200)}...`
            );
          }
          jsonContent = jsonMatch[1].trim();
        } else {
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
        const approachTaken = await summarizeLLMConversationForApproach(
          messages,
          modifiedScenario.taskDescription,
          executionHistory,
          geminiProvider,
          options.debug
        );

        // Build the result using the simplified parsed response and Gemini's approach summary
        const result: TestScenarioResult = {
          id: scenarioId,
          type: scenario.type,
          description: scenario.description,
          taskDescription: scenario.taskDescription,
          approachTaken,
          commands: [],
          actualCommands: executionHistory.map((h) => h.args.command),
          output: parsedResponse.summary,
          outputBuffer, // Include the output buffer in the result
          toolExecutions: executionHistory,
          expectedBehavior: [],
          successCriteria: [],
          result: parsedResponse.status,
          executionTime: parsedResponse.executionTime,
          attempts,
          explanation: parsedResponse.error || parsedResponse.summary,
        };

        console.log(
          `${result.result === 'PASS' ? '✅' : '❌'} Scenario ${scenarioId} execution completed with ${result.result} in ${result.executionTime.toFixed(2)} seconds (${result.description})\n`
        );

        return result;
      } catch (error: unknown) {
        // Handle transient errors with retry
        if (isTransientError(error) && attempts < retryConfig.retries) {
          const delay = calculateBackoffDelay(attempts, retryConfig);
          appendToBuffer(
            `⚠️ Transient error: ${error instanceof Error ? error.message : String(error)}. Retrying in ${delay}ms (attempt ${attempts}/${retryConfig.retries})...\n`,
            true
          );
          await sleep(delay);
          continue;
        }

        // Handle timeout errors
        if (error instanceof TestTimeoutError) {
          appendToBuffer(`⏱️ Timeout exceeded (${timeout}s) for scenario ${scenarioId}\n`, true);
          throw error;
        }

        // Handle other errors
        console.log(
          `❌ Error executing scenario: ${error instanceof Error ? error.message : String(error)}\n`
        );
        if (error instanceof Error && error.stack && debug) {
          console.error(`Stack trace: ${error.stack}\n`);
        }

        throw error;
      }
    }

    // If we've exhausted all retries, throw an error
    throw new TestExecutionError(
      `Failed to execute scenario ${scenarioId} after ${retryConfig.retries} attempts`
    );
  } finally {
    // Clean up the temporary directory
    await TestEnvironmentManager.cleanup(tempDir);
    appendToBuffer(`Cleaned up temporary directory: ${tempDir}\n`);
  }
}
