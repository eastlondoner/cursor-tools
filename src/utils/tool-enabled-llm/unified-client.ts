import { Anthropic } from '@anthropic-ai/sdk';
import { Tool, ToolUseBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import { Stream } from '@anthropic-ai/sdk/streaming.mjs';
import OpenAI from 'openai';
import { ChatCompletionChunk, ChatCompletionTool } from 'openai/resources/index.mjs';
import { Stream as OpenAIStream } from 'openai/streaming.mjs';

import {
  StdioClientTransport,
  StdioServerParameters,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { ProviderError } from '../../errors.js';

// Define core interfaces
export interface InternalMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string | Array<ToolResult | ToolUseBlockParam | TextBlockParam>;
  tool_call_id?: string;
  name?: string;
  cache_control?: { type: string };
}

export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  cache_control?: { type: string };
}

export interface ToolCall {
  name: string;
  args: any;
  result: ToolExecutionResult;
  tool_use_id: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<ToolExecutionResult>;
}

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  error?: {
    message: string;
    code?: number;
    details?: Record<string, any>;
  };
}

export interface UnifiedLLMClientOptions {
  provider: 'anthropic' | 'openrouter';
  model: string;
  debug: boolean;
  maxTokens: number;
  temperature?: number;
  topP?: number;
  logger: (message: string) => void;
  mcpMode: boolean; // Flag to enable MCP-specific behaviors if needed
  mcpConfig?: StdioServerParameters;
}

function transformToAnthropicMessages(messages: InternalMessage[]) {
  return messages.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: asValidMessageContentObject(msg.content) || [
      {
        type: 'text' as const,
        text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      },
    ],
  }));
}

function transformToOpenRouterMessages(
  messages: InternalMessage[],
  systemPrompt: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    {
      role: 'system',
      content: [
        {
          type: 'text',
          text: systemPrompt,
          // @ts-ignore
          cache_control: { type: 'ephemeral' },
        },
      ],
    },
    ...messages.map((msg) => {
      return {
        role: msg.role as 'user' | 'assistant',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        tool_call_id: msg.tool_call_id,
        name: msg.name,
      };
    }),
  ];
}

function asValidMessageContentObject(content: string | any[]): Anthropic.MessageParam['content'] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  if (Array.isArray(content)) {
    // Check if this is an Anthropic-compatible array already
    const isAnthropicCompatible = content.every(
      (item) =>
        typeof item === 'object' &&
        (item.type === 'text' || item.type === 'tool_use' || item.type === 'tool_result')
    );

    if (isAnthropicCompatible) {
      return content as Anthropic.MessageParam['content'];
    }

    // Otherwise, fallback to converting to JSON string
    return [{ type: 'text', text: JSON.stringify(content) }];
  }

  return [{ type: 'text', text: JSON.stringify(content) }];
}

/**
 * Unified Tool-Enabled LLM Client that supports both Anthropic and OpenRouter
 */
export class UnifiedLLMClient {
  private anthropicClient?: Anthropic = undefined;
  private openrouterClient?: OpenAI = undefined;
  private messages: InternalMessage[] = [];
  private tools: Tool[] | ChatCompletionTool[] = [];
  private toolCalls: ToolCall[] = [];
  private toolDefinitions: ToolDefinition[] = [];
  private config: UnifiedLLMClientOptions;
  private logger: (message: string) => void;

  // MCP-specific properties
  private mcpClient?: Client;
  private transport?: StdioClientTransport;

  constructor(options: UnifiedLLMClientOptions, toolDefinitions: ToolDefinition[] = []) {
    this.config = {
      ...options,
      maxTokens: options.maxTokens || 8192,
    };

    this.logger =
      options.logger ||
      ((message: string) => {
        if (this.config.debug) {
          console.log(message);
        }
      });

    // TODO: change this to use our createProvider stuff
    // Initialize LLM clients based on provided API keys
    if (this.config.provider === 'anthropic') {
      // Determine API key (this should be properly managed elsewhere)
      const apiKey = process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey) {
        throw new ProviderError(
          'ANTHROPIC_API_KEY not found in environment. Required for tool-enabled testing.'
        );
      }
      this.anthropicClient = new Anthropic({
        apiKey,
      });
    } else if (this.config.provider === 'openrouter') {
      // Get the appropriate API key

      const openrouterApiKey = process.env.OPENROUTER_API_KEY;
      if (!openrouterApiKey) {
        throw new ProviderError('OPENROUTER_API_KEY environment variable is not set');
      }

      const headers = {
        'HTTP-Referer': 'http://vibe-tools.com',
        'X-Title': 'vibe-tools',
      };

      this.openrouterClient = new OpenAI({
        apiKey: openrouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: headers,
      });
    } else {
      throw new Error('Invalid provider ' + this.config.provider);
    }

    // Initialize MCP client if in MCP mode
    if (this.config.mcpMode && this.config.mcpConfig) {
      if (this.config.debug) {
        console.log(
          'Initializing MCP client...',
          this.config.mcpConfig.command,
          this.config.mcpConfig.args
        );
      }
      this.initMCPClient();
    }

    // Register tools
    toolDefinitions.forEach((tool) => this.registerTool(tool));
  }

  async processCompletionNoTools(
    messages: InternalMessage[],
    systemPrompt: string
  ): Promise<string> {
    const result =
      (await this.openrouterClient?.chat.completions.create({
        messages: transformToOpenRouterMessages(messages, systemPrompt),
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        tools: [], // deliberately no tools
      })) ??
      (await this.anthropicClient?.messages.create({
        messages: transformToAnthropicMessages(messages),
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        tools: [], // deliberately no tools
      }));

    if (!result) {
      throw new Error(
        'No valid client configured. Please provide either ANTHROPIC_API_KEY or OPENROUTER_API_KEY'
      );
    }

    return 'choices' in result
      ? (result?.choices[0]?.message.content ?? JSON.stringify(result))
      : result.content
          .flatMap((content) => {
            if ('text' in content) {
              return content.text;
            }
            if (typeof content === 'string') {
              return content;
            }
            return JSON.stringify(content);
          })
          .join('\n');
  }
  /**
   * Process a user query with tool execution
   * @param query The user query to process
   * @param systemPrompt The system prompt to use
   * @param maxApiCalls Maximum number of API calls allowed (default: 30)
   * @returns Array of messages representing the conversation
   */
  async processQuery(
    query: string,
    systemPrompt: string,
    maxApiCalls: number = 30
  ): Promise<InternalMessage[]> {
    try {
      // Add user message
      this.messages.push({
        role: 'user',
        content: query,
      });

      let continueConversation = true;
      let stopReason: string | null | undefined;
      const provider = this.config.provider;
      const model =
        this.config.model ||
        (provider === 'anthropic' ? 'claude-3-7-sonnet-latest' : 'anthropic/claude-3-7-sonnet');

      // Track API call count if maxApiCalls is specified
      let apiCallCount = 0;

      console.log(`Using ${provider} with model ${model}`);

      while (continueConversation) {
        // Before making the API call, update cache control for last 3 user messages

        if (this.messages.length > 0) {
          const lastThreeUserIndices = this.messages.map((_, idx) => idx).slice(-3);

          this.messages.forEach((_, idx) => {
            if (lastThreeUserIndices.includes(idx)) {
              this.messages[idx].cache_control = { type: 'ephemeral' };
            } else {
              delete this.messages[idx].cache_control;
            }
          });
        }

        // Check if we've reached the maximum number of API calls
        if (maxApiCalls !== undefined && apiCallCount >= maxApiCalls) {
          const errorMessage = `Maximum number of API calls (${maxApiCalls}) reached.`;
          this.logger(`\n${errorMessage}`);

          // Add an error message to the conversation
          this.messages.push({
            role: 'assistant',
            content: `I'm sorry, but I've reached the maximum number of AI tool API calls allowed for this request (${maxApiCalls}). To prevent excessive usage and unexpected costs, I've terminated this conversation. If you need a more complex task completed, consider breaking it down into smaller steps or increasing the 'maxApiCalls' limit if possible.`,
          });

          // Break out of the conversation loop
          break;
        }

        // Increment the API call counter
        apiCallCount++;

        if (this.config.debug) {
          this.logger(
            `\n[API Call ${apiCallCount}${maxApiCalls ? ` of max ${maxApiCalls}` : ''}] Sending ${this.messages.length} messages to ${model} for chat completion...`
          );
        }

        if (provider === 'openrouter' && this.openrouterClient) {
          const response = await this.openrouterClient.chat.completions.create({
            messages: transformToOpenRouterMessages(this.messages, systemPrompt),
            model: model,
            stream: true,
            tools: this.tools as ChatCompletionTool[],
            max_tokens: this.config.maxTokens,
          });
          stopReason = await this.processOpenRouterStream(response);
        } else if (this.anthropicClient) {
          const anthropicMessages = transformToAnthropicMessages(this.messages);

          const stream = await this.anthropicClient.messages.create({
            messages: anthropicMessages,
            model,
            max_tokens: this.config.maxTokens ?? 8092,
            tools: this.tools as Tool[],
            stream: true,
            system: [
              {
                type: 'text',
                text: systemPrompt,
                // @ts-ignore
                cache_control: { type: 'ephemeral' },
              },
            ],
          });
          stopReason = await this.processAnthropicStream(stream);
        } else {
          throw new Error(
            'No valid client configured. Please provide either ANTHROPIC_API_KEY or OPENROUTER_API_KEY'
          );
        }

        continueConversation = stopReason === 'tool_use';
      }

      // Return all messages except the first system message if present
      // @ts-ignore
      return this.messages.slice(this.messages[0]?.role === 'system' ? 1 : 0);
    } catch (error) {
      console.error('\nError during query processing:', error);
      if (this.config.debug) {
        console.error('Detailed error:', error);
      }
      throw error;
    }
  }

  /**
   * Process Anthropic message stream
   */
  private async processAnthropicStream(
    stream: Stream<Anthropic.Messages.RawMessageStreamEvent>
  ): Promise<string | null | undefined> {
    try {
      let currentTextBlock: TextBlockParam | null = null;
      let pendingToolUseBlock: ToolUseBlockParam | null = null;
      let currentToolInputString = '';
      const messageDelta: InternalMessage = {
        role: 'assistant',
        content: [] as Array<ToolResult | ToolUseBlockParam | TextBlockParam>,
      };
      let stopReason: string | null | undefined = undefined;

      for await (const chunk of stream) {
        if (chunk.type === 'message_start') {
          messageDelta.role = 'assistant';
          messageDelta.content = [];
          currentToolInputString = '';
        } else if (chunk.type === 'content_block_start') {
          if (chunk.content_block.type === 'text') {
            currentTextBlock = {
              type: 'text',
              text: '',
            };
          } else if (chunk.content_block.type === 'tool_use') {
            pendingToolUseBlock = {
              type: 'tool_use',
              id: chunk.content_block.id,
              name: chunk.content_block.name,
              input: {},
            };
          }
        } else if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta' && currentTextBlock) {
            currentTextBlock.text += chunk.delta.text;
          } else if (chunk.delta.type === 'input_json_delta' && pendingToolUseBlock) {
            if (chunk.delta.partial_json) {
              currentToolInputString += chunk.delta.partial_json;
            }
          }
        } else if (chunk.type === 'content_block_stop') {
          if (currentTextBlock) {
            if (Array.isArray(messageDelta.content)) {
              messageDelta.content.push(currentTextBlock);
            }
            currentTextBlock = null;
          } else if (pendingToolUseBlock) {
            try {
              const toolArgs =
                typeof currentToolInputString === 'string'
                  ? currentToolInputString.trim() === ''
                    ? undefined
                    : JSON.parse(currentToolInputString)
                  : (currentToolInputString ?? undefined);

              pendingToolUseBlock.input = toolArgs;

              if (Array.isArray(messageDelta.content)) {
                messageDelta.content.push(pendingToolUseBlock);
              }

              const toolUseId = pendingToolUseBlock.id;
              const toolName = pendingToolUseBlock.name;

              this.logger(`\n[Tool Call] ${toolName}(${JSON.stringify(toolArgs)})`);

              // First add the assistant message with the tool_use block
              this.messages.push({
                role: 'assistant',
                content: [
                  {
                    type: 'tool_use',
                    id: toolUseId,
                    name: toolName,
                    input: toolArgs ?? {},
                  },
                ],
              });

              try {
                const result = await this.executeToolCall(toolName, toolArgs);

                if (!result.success) {
                  this.logger(`\n[Tool Error] ${JSON.stringify(result)}`);
                  this.messages.push({
                    role: 'user',
                    content: [
                      {
                        type: 'tool_result',
                        tool_use_id: toolUseId,
                        content: result.error?.message ?? result.output,
                      },
                    ],
                  });
                } else {
                  // Add tool result as a user message with the proper structure
                  this.messages.push({
                    role: 'user',
                    content: [
                      {
                        type: 'tool_result',
                        tool_use_id: toolUseId,
                        content: result.output,
                      },
                    ],
                  });
                }

                this.logger(`\n[Tool Result] ${result.output}`);
              } catch (error) {
                console.error(`Error executing tool ${toolName}:`, error);

                // Even for errors, we need to maintain the proper message structure
                this.messages.push({
                  role: 'user',
                  content: [
                    {
                      type: 'tool_result',
                      tool_use_id: toolUseId,
                      content: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
                    },
                  ],
                });
              }
            } catch (error) {
              console.error('Error parsing tool input JSON:', error);
              console.error('Raw JSON string:', currentToolInputString);
            }

            // Reset message delta since we've already added it to messages
            messageDelta.content = [];
            pendingToolUseBlock = null;
            currentToolInputString = '';
          }
        } else if (chunk.type === 'message_delta') {
          if (chunk.delta.stop_reason) {
            stopReason = chunk.delta.stop_reason;
          }
        } else if (chunk.type === 'message_stop') {
          if (currentTextBlock && Array.isArray(messageDelta.content)) {
            messageDelta.content.push(currentTextBlock);
          }
        }
      }

      // Only add the final message if it has content and we haven't already added it (for tool calls)
      if (Array.isArray(messageDelta.content) && messageDelta.content.length > 0) {
        this.messages.push({
          role: 'assistant',
          content: messageDelta.content,
        });
      }

      return stopReason;
    } catch (error) {
      console.error(
        '\nError during Anthropic stream processing:',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Process OpenRouter message stream
   */
  private async processOpenRouterStream(
    stream: OpenAIStream<ChatCompletionChunk>
  ): Promise<string | null | undefined> {
    let currentContent = '';
    let isInToolCall = false;
    let toolCallName = '';
    let toolCallArgs = '';
    let toolCallId = '';
    let stopReason: string | null | undefined = undefined;

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (!delta) continue;

        // Handle regular content
        if (delta.content) {
          currentContent += delta.content;
        }

        // Handle tool calls
        if (delta.tool_calls && delta.tool_calls.length > 0) {
          const toolCall = delta.tool_calls[0];

          // Start of a tool call
          if (toolCall.id && !isInToolCall) {
            isInToolCall = true;
            toolCallId = toolCall.id;
            toolCallName = toolCall.function?.name || '';
            toolCallArgs = toolCall.function?.arguments || '';
          }

          // Tool call arguments receiving
          if (toolCall.function?.arguments) {
            toolCallArgs += toolCall.function.arguments;
          }
        }

        // Check for finish_reason
        if (chunk.choices[0]?.finish_reason) {
          stopReason = chunk.choices[0].finish_reason;
        }
      }

      // Handle any final text content first
      if (currentContent.trim()) {
        this.messages.push({
          role: 'assistant',
          content: currentContent,
        });
      }

      // Execute the tool call if present
      if (isInToolCall && toolCallName) {
        this.logger(`\n[Tool Call] ${toolCallName}(${toolCallArgs})`);

        try {
          // Check if we have a cached result for this exact tool call
          const cachedCall = this.toolCalls.find(
            (call) =>
              call.name === toolCallName &&
              (call.args === toolCallArgs || JSON.stringify(call.args) === toolCallArgs) &&
              call.tool_use_id === toolCallId
          );

          let result: ToolExecutionResult;
          if (cachedCall) {
            if (this.config.debug) {
              console.log('using cached tool result', toolCallName);
            }
            result = cachedCall.result;
          } else {
            result = await this.executeToolCall(toolCallName, toolCallArgs);
            // Cache the result
            this.toolCalls.push({
              name: toolCallName,
              args: typeof toolCallArgs === 'string' ? toolCallArgs : JSON.stringify(toolCallArgs),
              result,
              tool_use_id: toolCallId,
            });
          }

          // Add tool result message in OpenRouter format
          const toolResultMessage: InternalMessage = {
            role: 'user' as const,
            content: result.output,
            tool_call_id: toolCallId,
          };
          this.messages.push(toolResultMessage);

          this.logger(`\n[Tool Result] ${result.output}`);

          // Set stop reason to tool_use to continue the conversation
          stopReason = 'tool_use';
        } catch (error) {
          const errorMessage = `Error executing tool ${toolCallName}: ${error instanceof Error ? error.message : String(error)}`;
          this.messages.push({
            role: 'assistant',
            content: errorMessage,
            tool_call_id: toolCallId,
          });

          this.logger(`\n[Tool Error] ${errorMessage}`);
          // Even on error, we want to continue the conversation
          stopReason = 'tool_use';
        }
      }

      if (this.config.debug) {
        console.log('\n[Message Complete]');
      }

      return stopReason;
    } catch (error) {
      console.error('Error processing OpenRouter stream:', error);
      throw error;
    }
  }

  /**
   * Initialize the MCP client and transport
   */
  private initMCPClient(): void {
    if (!this.config.mcpConfig) {
      throw new Error('MCP configuration is required when in MCP mode');
    }

    this.mcpClient = new Client({ name: 'cli-client', version: '1.0.0' }, { capabilities: {} });
    this.transport = new StdioClientTransport(this.config.mcpConfig);
  }

  /**
   * Start the MCP client
   */
  public async startMCP(): Promise<void> {
    if (!this.config.mcpMode) {
      throw new Error('Client is not in MCP mode');
    }

    if (!this.mcpClient || !this.transport) {
      this.initMCPClient();
    }

    try {
      // Connect to the server
      await this.mcpClient!.connect(this.transport!);

      // Initialize MCP tools from the server
      await this.initMCPTools();

      if (this.config.debug) {
        console.log('MCP client started successfully');
      }
    } catch (error) {
      console.error('Failed to start MCP client:', error);
      throw error;
    }
  }

  /**
   * Stop the MCP client
   */
  public async stopMCP(): Promise<void> {
    if (this.mcpClient && this.transport) {
      try {
        await this.mcpClient.close();
        if (this.config.debug) {
          console.log('MCP client stopped successfully');
        }
      } catch (error) {
        console.error('Error stopping MCP client:', error);
      }
    }
  }

  /**
   * Initialize MCP tools from the server
   */
  public async initMCPTools(): Promise<void> {
    if (!this.mcpClient) {
      throw new Error('MCP client is not initialized');
    }

    try {
      // Get tool descriptions from the MCP server
      const toolDescriptions = await this.mcpClient.listTools();

      if (this.config.debug) {
        console.log('Available MCP tools:', JSON.stringify(toolDescriptions, null, 2));
      }

      for (const tool of toolDescriptions.tools) {
        // Add to internal tool definitions for execution
        this.toolDefinitions.push({
          name: tool.name,
          description: tool.description ?? '',
          parameters: tool.inputSchema ?? {},
          execute: async (args: any) => {
            try {
              const result = await this.mcpClient!.request(
                {
                  method: 'tools/call',
                  params: {
                    name: tool.name,
                    arguments: args
                      ? typeof args === 'string'
                        ? JSON.parse(args)
                        : args
                      : undefined,
                  },
                },
                CallToolResultSchema
              );

              return {
                success: true,
                output: result.content
                  .flatMap((content) => {
                    if ('text' in content) {
                      return content.text as string;
                    }
                    return '';
                  })
                  .join('\n'),
              };
            } catch (error) {
              return {
                success: false,
                output: `Error executing MCP tool ${tool.name}: ${error instanceof Error ? error.message : String(error)}`,
                error: {
                  message: error instanceof Error ? error.message : String(error),
                },
              };
            }
          },
        });

        // Add to provider-specific tool format
        if (this.config.provider === 'openrouter') {
          // OpenRouter format
          (this.tools as ChatCompletionTool[]).push({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description || '',
              parameters: {
                type: 'object',
                properties: tool.inputSchema.properties || {},
                required: tool.inputSchema.required || [],
              },
            },
          });
        } else {
          // Anthropic format
          (this.tools as Tool[]).push({
            name: tool.name,
            description: tool.description || '',
            input_schema: {
              type: 'object',
              properties: tool.inputSchema.properties || {},
              required: tool.inputSchema.required || [],
            },
          });
        }
      }

      if (this.config.debug) {
        console.log(`Initialized ${toolDescriptions.tools.length} MCP tools`);
      }
    } catch (error) {
      console.error('Error initializing MCP tools:', error);
      throw error;
    }
  }

  /**
   * Register a tool with the client
   */
  public registerTool(tool: ToolDefinition): void {
    this.toolDefinitions.push(tool);

    // Add to Anthropic tools format
    const anthropicTool: Tool = {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters.properties || {},
        required: tool.parameters.required || [],
      },
    };

    // Add to OpenAI tools format
    const openaiTool: ChatCompletionTool = {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };

    // Add to appropriate tool collection based on current provider
    if (this.config.provider === 'anthropic') {
      this.tools = [...(this.tools as Tool[]), anthropicTool];
    } else {
      this.tools = [...(this.tools as ChatCompletionTool[]), openaiTool];
    }
  }

  /**
   * Execute a tool call by name and arguments
   */
  private async executeToolCall(
    toolName: string,
    argsString: string
  ): Promise<ToolExecutionResult> {
    try {
      // Parse arguments if it's a string
      const args = typeof argsString === 'string' ? argsString : JSON.stringify(argsString);

      // Find the tool definition
      const toolDef = this.toolDefinitions.find((t) => t.name === toolName);
      if (!toolDef) {
        throw new Error(`Tool "${toolName}" not found`);
      }

      // Generate tool use ID
      const toolUseId = this.generateToolUseId();

      // Execute the tool
      const result = await toolDef.execute(args);

      // Record the tool call
      this.toolCalls.push({
        name: toolName,
        args,
        result,
        tool_use_id: toolUseId,
      });

      return result;
    } catch (error) {
      console.error(`Error executing tool "${toolName}":`, error);
      return {
        success: false,
        output: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Format tool call for logging
   */
  private formatToolCall(toolName: string, args: any): string {
    return `${toolName}(${this.formatToolCallArgs(args)})`;
  }

  /**
   * Format tool call arguments for logging
   */
  private formatToolCallArgs(args: any): string {
    if (typeof args === 'string') {
      try {
        return JSON.stringify(JSON.parse(args), null, 2);
      } catch {
        return args;
      }
    }
    return JSON.stringify(args, null, 2);
  }

  /**
   * Generate a unique ID for tool use
   */
  private generateToolUseId(): string {
    // Generate a unique tool use ID in the format toolu_01A09q90qw90lq917835lq9
    const randomStr =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    return `toolu_${randomStr}`;
  }

  /**
   * Get the execution history of tool calls
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
