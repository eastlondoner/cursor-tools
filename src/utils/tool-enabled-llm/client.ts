import { Anthropic } from '@anthropic-ai/sdk';
import { Tool, ToolUseBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import { Stream } from '@anthropic-ai/sdk/streaming.mjs';

/**
 * Message interface used internally by the tool-enabled LLM client
 */
export interface InternalMessage {
  role: 'user' | 'assistant';
  content: string | Array<ToolResult | ToolUseBlockParam | TextBlockParam>;
}

/**
 * Tool result interface representing the result of a tool execution
 */
export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

/**
 * Tool call interface representing a record of a tool being called
 */
export interface ToolCall {
  name: string;
  args: any;
  result: ToolExecutionResult;
  tool_use_id: string;
}

/**
 * Tool definition interface for registering tools with the client
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<ToolExecutionResult>;
}

/**
 * Result of a tool execution with standardized structure
 */
export interface ToolExecutionResult {
  success: boolean;
  output: string;
  error?: {
    message: string;
    code?: number;
    details?: Record<string, any>;
  };
}

/**
 * Client options for configuring the tool-enabled LLM client
 */
export interface ToolEnabledLLMClientOptions {
  debug?: boolean;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  model?: string;
  logger?: (message: string) => void;
}

/**
 * A client for interacting with LLMs that supports tool usage
 */
export class ToolEnabledLLMClient {
  private anthropicClient: Anthropic;
  private messages: InternalMessage[] = [];
  private tools: Tool[] = [];
  private toolCalls: ToolCall[] = [];
  private model: string;
  private debug: boolean;
  private maxTokens: number;
  private temperature: number;
  private topP: number;
  private toolDefinitions: ToolDefinition[] = [];
  private logger: (message: string) => void;

  /**
   * Create a new ToolEnabledLLMClient
   *
   * @param apiKey - The Anthropic API key
   * @param options - Configuration options for the client
   * @param toolDefinitions - Tool definitions to register with the client
   */
  constructor(
    private apiKey: string,
    options: ToolEnabledLLMClientOptions = {},
    toolDefinitions: ToolDefinition[] = []
  ) {
    this.anthropicClient = new Anthropic({ apiKey });
    this.model = options.model || 'claude-3-7-sonnet-latest';
    this.debug = options.debug || false;
    this.maxTokens = options.maxTokens || 8192;
    this.temperature = options.temperature || 0.7;
    this.topP = options.topP || 0.9;

    // Set default logger if none provided
    this.logger =
      options.logger ||
      ((message: string) => {
        if (message.startsWith('\nError') || message.startsWith('Error')) {
          console.error(message);
        } else {
          process.stdout.write(message);
        }
      });

    // Register all provided tools
    for (const tool of toolDefinitions) {
      this.registerTool(tool);
    }
  }

  /**
   * Process a query using the LLM with tools enabled
   *
   * @param query - The query to process
   * @param systemPrompt - The system prompt to use
   * @param maxApiCalls - Maximum number of API calls allowed (default: unlimited)
   * @returns The conversation messages
   */
  async processQuery(query: string, systemPrompt: string, maxApiCalls?: number): Promise<InternalMessage[]> {
    try {
      // Reset tool calls for new query
      this.toolCalls = [];
      this.messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: query,
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ];

      let continueConversation = true;
      // Track API call count if maxApiCalls is specified
      let apiCallCount = 0;

      while (continueConversation) {
        // Check if we've reached the maximum number of API calls
        if (maxApiCalls !== undefined && apiCallCount >= maxApiCalls) {
          const errorMessage = `Maximum number of API calls (${maxApiCalls}) reached.`;
          this.logger(`\n${errorMessage}`);
          
          // Add an error message to the conversation
          this.messages.push({
            role: 'assistant',
            content: `I'm sorry, but I've reached the maximum number of API calls allowed (${maxApiCalls}) for this request. The conversation has been terminated to prevent excessive API usage.`
          });
          
          // Break out of the conversation loop
          break;
        }
        
        // Increment the API call counter
        apiCallCount++;
        
        if (this.debug) {
          this.logger(`\nSending ${this.messages.length} messages to ${this.model}... (API call ${apiCallCount}${maxApiCalls ? ` of max ${maxApiCalls}` : ''})`);
        }

        const stream = await this.anthropicClient.messages.create({
          messages: this.messages,
          model: this.model,
          max_tokens: this.maxTokens,
          tools: this.tools,
          stream: true,
          system: systemPrompt,
          temperature: this.temperature,
          top_p: this.topP,
        });

        const stopReason = await this.processStream(stream);

        // Continue only if we used a tool and need another turn
        continueConversation = stopReason === 'tool_use';
      }

      return this.messages;
    } catch (error) {
      this.logger(
        '\nError during query processing: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
      if (error instanceof Error) {
        this.logger('I apologize, but I encountered an error: ' + error.message + '\n');
      }
      throw error;
    }
  }

  /**
   * Process a stream of events from the LLM
   *
   * @param stream - The stream to process
   * @returns The stop reason from the LLM
   */
  private async processStream(
    stream: Stream<Anthropic.Messages.RawMessageStreamEvent>
  ): Promise<string | null | undefined> {
    let currentMessage = '';
    let currentToolName = '';
    let currentToolInputString = '';
    let lastStopReason: string | null | undefined;
    let currentToolUseId: string | null = null;

    try {
      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'message_start':
            // Reset currentMessage at the start of a new message
            currentMessage = '';
            continue;
          case 'content_block_stop':
            // Store the current message block if it exists
            if (currentMessage) {
              this.messages.push({
                role: 'assistant',
                content: currentMessage,
              });
              currentMessage = '';
            }
            continue;
          case 'content_block_start':
            if (chunk.content_block?.type === 'tool_use') {
              currentToolName = chunk.content_block.name;
              currentToolUseId = this.generateToolUseId();
            }
            break;
          case 'content_block_delta':
            if (chunk.delta.type === 'text_delta') {
              currentMessage += chunk.delta.text;
              this.logger(chunk.delta.text);
            } else if (chunk.delta.type === 'input_json_delta') {
              if (currentToolName && chunk.delta.partial_json) {
                currentToolInputString += chunk.delta.partial_json;
              }
            }
            break;
          case 'message_delta':
            if (chunk.delta.stop_reason === 'tool_use') {
              // Store the current message if it exists before handling tool use
              if (currentMessage) {
                this.messages.push({
                  role: 'assistant',
                  content: currentMessage,
                });
                currentMessage = '';
              }

              const toolArgs = currentToolInputString ? JSON.parse(currentToolInputString) : {};
              if (this.debug) {
                this.logger(
                  `\nTool call requested: ${currentToolName}${this.formatToolCallArgs(toolArgs)}`
                );
              }

              // Store the tool use request in message history
              this.messages.push({
                role: 'assistant',
                content: [
                  {
                    type: 'tool_use',
                    id: currentToolUseId!,
                    name: currentToolName,
                    input: toolArgs,
                  },
                ],
              });

              // Check if this exact tool call has already been made
              const toolCallKey = JSON.stringify({ name: currentToolName, args: toolArgs });
              const existingCall = this.toolCalls.find(
                (call) => JSON.stringify({ name: call.name, args: call.args }) === toolCallKey
              );

              if (existingCall) {
                if (this.debug) {
                  this.logger(
                    `\nCache hit for tool call: ${currentToolName}${this.formatToolCallArgs(toolArgs)}`
                  );
                  this.logger(
                    `${this.formatToolCall(currentToolName, toolArgs)}\n(Using cached result)\n`
                  );
                }

                this.messages.push({
                  role: 'user',
                  content: [
                    {
                      type: 'tool_result',
                      tool_use_id: currentToolUseId!,
                      content: existingCall.result.output,
                    },
                  ],
                });
              } else {
                // Find the corresponding tool definition
                const toolDefinition = this.toolDefinitions.find(
                  (tool) => tool.name === currentToolName
                );

                if (!toolDefinition) {
                  const errorMessage = `Tool '${currentToolName}' not found`;
                  this.logger(errorMessage);

                  // Report error back to LLM
                  this.messages.push({
                    role: 'user',
                    content: [
                      {
                        type: 'tool_result',
                        tool_use_id: currentToolUseId!,
                        content: JSON.stringify({
                          success: false,
                          output: errorMessage,
                          error: {
                            message: errorMessage,
                          },
                        }),
                      },
                    ],
                  });
                } else {
                  // Otherwise, execute the tool and cache the result
                  if (this.debug) {
                    this.logger(
                      `\nExecuting tool: ${currentToolName}${this.formatToolCallArgs(toolArgs)}`
                    );
                  }

                  try {
                    // Execute the tool
                    const result = await toolDefinition.execute(toolArgs);

                    if (this.debug) {
                      this.logger(
                        `\nTool execution complete: ${currentToolName}${this.formatToolCallArgs(toolArgs)}`
                      );
                    }

                    // Cache the tool call and result
                    this.toolCalls.push({
                      name: currentToolName,
                      args: toolArgs,
                      result,
                      tool_use_id: currentToolUseId!,
                    });

                    // Add the tool result to message history
                    this.messages.push({
                      role: 'user',
                      content: [
                        {
                          type: 'tool_result',
                          tool_use_id: currentToolUseId!,
                          content: result.output,
                        },
                      ],
                    });
                  } catch (error) {
                    // Handle tool execution error
                    const errorMessage =
                      error instanceof Error
                        ? error.message
                        : 'Unknown error during tool execution';

                    this.logger(`\nTool execution error: ${errorMessage}`);

                    // Report error back to LLM
                    const errorResult: ToolExecutionResult = {
                      success: false,
                      output: `Tool execution failed: ${errorMessage}`,
                      error: {
                        message: errorMessage,
                      },
                    };

                    // Cache the error result
                    this.toolCalls.push({
                      name: currentToolName,
                      args: toolArgs,
                      result: errorResult,
                      tool_use_id: currentToolUseId!,
                    });

                    // Add the error result to message history
                    this.messages.push({
                      role: 'user',
                      content: [
                        {
                          type: 'tool_result',
                          tool_use_id: currentToolUseId!,
                          content: errorResult.output,
                        },
                      ],
                    });
                  }
                }
              }

              // Reset for next tool call
              currentToolName = '';
              currentToolInputString = '';
              currentToolUseId = null;
            }

            lastStopReason = chunk.delta.stop_reason;
            break;
          case 'message_stop':
            // Final message completion, may not need additional handling
            break;
        }
      }

      return lastStopReason;
    } catch (error) {
      this.logger(
        '\nError during stream processing: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
      throw error;
    }
  }

  /**
   * Format a tool call for display
   *
   * @param toolName - The name of the tool
   * @param args - The arguments for the tool
   * @returns A formatted string representing the tool call
   */
  private formatToolCall(toolName: string, args: any): string {
    return `${toolName}${this.formatToolCallArgs(args)}`;
  }

  /**
   * Format tool call arguments for display
   *
   * @param args - The arguments to format
   * @returns A formatted string representing the arguments
   */
  private formatToolCallArgs(args: any): string {
    return args && Object.keys(args).length > 0 ? `(${JSON.stringify(args)})` : '()';
  }

  /**
   * Generate a unique ID for a tool use
   *
   * @returns A unique ID
   */
  private generateToolUseId(): string {
    return `tool-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Register a tool with the client
   *
   * @param tool - The tool definition to register
   */
  public registerTool(tool: ToolDefinition): void {
    if (this.toolDefinitions.some((t) => t.name === tool.name)) {
      throw new Error(`Tool with name '${tool.name}' is already registered`);
    }

    // Store the tool definition for execution
    this.toolDefinitions.push(tool);

    // Convert to Anthropic's Tool format
    this.tools.push({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters.properties || {},
        required: tool.parameters.required || [],
      },
    });
  }

  /**
   * Get the history of tool executions
   *
   * @returns The tool execution history
   */
  public getExecutionHistory(): Array<{ tool: string; args: any; result: ToolExecutionResult }> {
    return this.toolCalls.map((call) => ({
      tool: call.name,
      args: call.args,
      result: call.result,
    }));
  }

  /**
   * Reset the client state
   */
  public reset(): void {
    this.messages = [];
    this.toolCalls = [];
  }
}
