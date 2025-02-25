import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';

import {
  StdioClientTransport,
  StdioServerParameters,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { ListToolsResultSchema, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Tool, ToolUseBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import { Stream } from '@anthropic-ai/sdk/streaming.mjs';
import { MCPAuthError, MCPError, handleMCPError, handleOpenRouterError } from './errors.js';

export interface InternalMessage {
  role: 'user' | 'assistant';
  content: string | Array<ToolResult | ToolUseBlockParam>;
}

interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

interface ToolCall {
  name: string;
  args: any;
  result: string;
  tool_use_id: string;
}

export interface MCPClientOptions extends StdioServerParameters {
  provider?: 'anthropic' | 'openrouter';
}

const SYSTEM_PROMPT = `You are a helpful AI assistant using tools.
When you receive a tool result, do not call the same tool again with the same arguments unless the user explicitly asks for it or the context changes significantly.
Use the results provided by the tools to answer the user's query.
If you have already called a tool with the same arguments and received a result, reuse the result instead of calling the tool again.
When you receive a tool result, focus on interpreting and explaining the result to the user rather than making additional tool calls.`;

// Helper function for exponential backoff retry
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 5,
  baseDelay: number = 1000, // 1 second
  shouldRetry: (error: unknown) => boolean = () => true
): Promise<T> {
  let attempt = 1;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}

export class MCPClient {
  private anthropicClient?: Anthropic;
  private openrouterClient?: OpenAI;
  private messages: InternalMessage[] = [];
  private mcpClient: Client;
  private transport: StdioClientTransport;
  private tools: Tool[] = [];
  private toolCalls: ToolCall[] = [];
  public config: MCPClientOptions;

  constructor(
    serverConfig: MCPClientOptions,
    private debug: boolean
  ) {
    this.config = serverConfig;
    const provider = serverConfig.provider || 'anthropic';
    
    try {
      if (provider === 'openrouter') {
        const openRouterApiKey = process.env.OPENROUTER_API_KEY;
        if (!openRouterApiKey) {
          throw new MCPAuthError('OPENROUTER_API_KEY environment variable is not set');
        }
        const headers = {
          'HTTP-Referer': 'http://cursor-tools.com',
          'X-Title': 'cursor-tools',
        };
        this.openrouterClient = new OpenAI({
          apiKey: openRouterApiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: headers,
        });
      } else {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new MCPAuthError('ANTHROPIC_API_KEY environment variable is not set');
        }
        this.anthropicClient = new Anthropic({
          apiKey,
        });
      }
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      
      if (provider === 'openrouter') {
        throw handleOpenRouterError(error);
      } else {
        throw handleMCPError(error);
      }
    }

    this.mcpClient = new Client({ name: 'cli-client', version: '1.0.0' }, { capabilities: {} });
    this.transport = new StdioClientTransport(this.config);
  }

  updateConfig(newConfig: MCPClientOptions) {
    try {
      this.config = { ...this.config, ...newConfig };
      this.transport = new StdioClientTransport(this.config);
      this.mcpClient = new Client({ name: 'cli-client', version: '1.0.0' }, { capabilities: {} });
      
      // Reinitialize clients if needed
      const provider = this.config.provider || 'anthropic';
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      
      if (provider === 'openrouter' && openRouterApiKey && !this.openrouterClient) {
        const headers = {
          'HTTP-Referer': 'http://cursor-tools.com',
          'X-Title': 'cursor-tools',
        };
        this.openrouterClient = new OpenAI({
          apiKey: openRouterApiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: headers,
        });
      } else if (provider === 'anthropic' && anthropicApiKey && !this.anthropicClient) {
        this.anthropicClient = new Anthropic({
          apiKey: anthropicApiKey,
        });
      }
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      
      if (this.config.provider === 'openrouter') {
        throw handleOpenRouterError(error);
      } else {
        throw handleMCPError(error);
      }
    }
  }

  async start(provider: 'anthropic' | 'openrouter' = 'anthropic') {
    try {
      // Use retryWithBackoff for connection
      await retryWithBackoff(
        async () => {
          await this.mcpClient.connect(this.transport);
        },
        3, // maxAttempts
        1000, // baseDelay
        (error: unknown) => {
          // Only retry on connection errors
          if (error instanceof Error) {
            return error.message?.includes('connect') || error.message?.includes('timeout');
          }
          return false;
        }
      );
      
      if (provider === 'anthropic') { // only init tools if using anthropic
        await this.initMCPTools();
      }
    } catch (error) {
      console.error('Failed to initialize MCP Client:', error);
      if (error instanceof MCPError) {
        throw error;
      }
      
      if (provider === 'openrouter') {
        const mcpError = handleOpenRouterError(error);
        throw mcpError;
      } else {
        const mcpError = handleMCPError(error);
        throw mcpError;
      }
    }
  }

  async stop() {
    try {
      await this.mcpClient.close();
    } catch (error) {
      const mcpError = handleMCPError(error);
      console.error('Error closing MCP Client:', mcpError);
      throw mcpError;
    }
  }

  private async initMCPTools() {
    try {
      const toolsResults = await this.mcpClient.request(
        { method: 'tools/list' },
        ListToolsResultSchema
      );
      this.tools = toolsResults.tools.map(({ inputSchema, ...tool }) => ({
        ...tool,
        input_schema: inputSchema,
      }));
    } catch (error) {
      const mcpError = handleMCPError(error);
      console.error('Failed to initialize MCP tools:', mcpError.message);
      throw mcpError;
    }
  }

  private formatToolCall(toolName: string, args: any): string {
    return `\n[${toolName}] ${JSON.stringify(args, null, 2)}\n`;
  }

  private formatToolCallArgs(args: any): string {
    return `(args: ${JSON.stringify(args, null, 2)})`;
  }

  private generateToolUseId(): string {
    // Generate a unique tool use ID in the format toolu_01A09q90qw90lq917835lq9
    const randomStr =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    return `toolu_${randomStr}`;
  }

  private async processStream(
    stream: Stream<Anthropic.Messages.RawMessageStreamEvent> | any,
    provider: 'anthropic' | 'openrouter' = 'anthropic'
  ): Promise<string | null | undefined> {
    let currentMessage = '';
    let currentToolName = '';
    let currentToolInputString = '';
    let lastStopReason: string | null | undefined;
    let currentToolUseId: string | null = null;
    let lastContent: string | null = null;

    try {
      for await (const chunk of stream) {
        if (provider === 'openrouter') {
          // Handle OpenRouter stream chunks
          if (chunk.choices && chunk.choices[0]) {
            const choice = chunk.choices[0];
            
            // Handle delta content
            if (choice.delta?.content) {
              currentMessage += choice.delta.content;
              lastContent = currentMessage;
            }
            
            // Handle finish reason
            if (choice.finish_reason) {
              lastStopReason = choice.finish_reason;
            }
          }
          continue;
        }
        
        // Handle Anthropic stream chunks
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
              lastContent = currentMessage;
            } else if (chunk.delta.type === 'input_json_delta') {
              if (currentToolName && chunk.delta.partial_json) {
                currentToolInputString += chunk.delta.partial_json;
              }
            }
            break;
          case 'message_delta':
            switch (chunk.delta.stop_reason) {
              case 'tool_use':
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
                  console.log(
                    `Tool call requested: ${currentToolName}${this.formatToolCallArgs(toolArgs)}`
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
                    // If we've already made this exact call, use the cached result
                    console.log(
                      `Cache hit for tool call: ${currentToolName}${this.formatToolCallArgs(toolArgs)}`
                    );
                    console.log(
                      `${this.formatToolCall(currentToolName, toolArgs)}\n(Using cached result)\n`
                    );
                  }
                  this.messages.push({
                    role: 'user',
                    content: [
                      {
                        type: 'tool_result',
                        tool_use_id: currentToolUseId!,
                        content: existingCall.result,
                      },
                    ],
                  });
                } else {
                  // Otherwise, make the call and cache the result
                  if (this.debug) {
                    console.log(
                      `Cache miss for tool call: ${currentToolName}${this.formatToolCallArgs(toolArgs)}`
                    );
                    console.log(this.formatToolCall(currentToolName, toolArgs));
                  }
                  try {
                    if (this.debug) {
                      console.log(
                        `Making MCP request: tools/call, name: ${currentToolName}, args: ${JSON.stringify(toolArgs, null, 2)}`
                      );
                    }
                    const toolResult = await this.mcpClient.request(
                      {
                        method: 'tools/call',
                        params: {
                          name: currentToolName,
                          arguments: toolArgs,
                        },
                      },
                      CallToolResultSchema
                    );
                    if (this.debug) {
                      console.log(
                        `MCP request finished for: ${currentToolName}${this.formatToolCallArgs(toolArgs)}`
                      );
                    }
                    const formattedResult = JSON.stringify(toolResult.content.flatMap((c) => c.text));

                    // Cache the tool call and result with tool_use_id
                    this.toolCalls.push({
                      name: currentToolName,
                      args: toolArgs,
                      result: formattedResult,
                      tool_use_id: currentToolUseId!,
                    });

                    // Push the tool result in the correct format
                    this.messages.push({
                      role: 'user',
                      content: [
                        {
                          type: 'tool_result',
                          tool_use_id: currentToolUseId!,
                          content: formattedResult,
                        },
                      ],
                    });
                  } catch (error) {
                    if (error instanceof MCPError) {
                      throw error;
                    }
                    const mcpError = handleMCPError(error);
                    console.error('\nError executing tool:', mcpError.message);
                    throw mcpError;
                  } finally {
                    // Reset tool related variables AFTER tool call is handled
                    currentToolName = '';
                    currentToolInputString = '';
                    currentToolUseId = null;
                  }
                }
                break;
              case 'stop_sequence':
              case 'stop_reason':
                // Handle other stop reasons
                break;
              default:
                // Handle other message_delta types
                break;
            }
            lastStopReason = chunk.delta.stop_reason;
            if (lastContent) {
              lastStopReason = `${lastStopReason}_${lastContent}`;
            }
            break;
          case 'message_stop':
            // Push the accumulated currentMessage when message_stop is received
            if (currentMessage) {
              this.messages.push({
                role: 'assistant',
                content: currentMessage,
              });
              currentMessage = ''; // Reset after pushing
            }
            break;
          default:
            console.warn(`Unknown event type: ${JSON.stringify(chunk)}`);
        }
      }
      
      // For OpenRouter, make sure to push the final message if it exists
      if (provider === 'openrouter' && currentMessage) {
        this.messages.push({
          role: 'assistant',
          content: currentMessage,
        });
      }
      
      return lastStopReason;
    } catch (error) {
      // If it's already an MCPError, just rethrow it
      if (error instanceof MCPError) {
        throw error;
      }
      
      if (provider === 'openrouter') {
        throw handleOpenRouterError(error);
      } else {
        const mcpError = handleMCPError(error);
        console.error('\nError processing stream:', mcpError.message);
        throw mcpError;
      }
    }
  }

  async processQuery(query: string, provider: 'anthropic' | 'openrouter' = 'anthropic', model?: string) {
    try {
      // Reset tool calls for new query
      this.toolCalls = [];
      this.messages = [
        { role: 'user', content: `Available variables ${printSafeEnvVars()}` },
        { role: 'user', content: query },
      ];

      let continueConversation = true;

      while (continueConversation) {
        let stream;
        try {
          if (provider === 'openrouter') {
            if (!this.openrouterClient) {
              throw new MCPError('OpenRouter client not initialized.');
            }
            
            // Use retryWithBackoff for API calls
            stream = await retryWithBackoff(
              async () => {
                const openRouterMessages = this.messages.map((message) => {
                  return {
                    role: message.role,
                    content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
                  }
                });

                // Add system message for OpenRouter
                const systemMessage = {
                  role: 'system',
                  content: SYSTEM_PROMPT
                };

                return this.openrouterClient!.chat.completions.create({
                  messages: [systemMessage as any, ...openRouterMessages as any],
                  model: model || 'anthropic/claude-3-sonnet',
                  max_tokens: 8192,
                  stream: true,
                });
              },
              5, // maxAttempts
              1000, // baseDelay
              (error: unknown) => {
                // Only retry on rate limits and server errors
                const err = error as any;
                return err.status === 429 || (err.status >= 500 && err.status < 600);
              }
            );
          } else {
            if (!this.anthropicClient) {
              throw new MCPError("Anthropic client not initialized");
            }
            
            // Use retryWithBackoff for API calls
            stream = await retryWithBackoff(
              async () => {
                return this.anthropicClient!.messages.create({
                  messages: this.messages,
                  model: model || 'claude-3-7-sonnet-thinking-latest', // Maintain existing default
                  max_tokens: 8192,
                  tools: this.tools,
                  stream: true,
                  system: SYSTEM_PROMPT,
                });
              },
              5, // maxAttempts
              1000, // baseDelay
              (error: unknown) => {
                // Only retry on rate limits and server errors
                const err = error as any;
                return err.status === 429 || (err.status >= 500 && err.status < 600);
              }
            );
          }
        } catch (error) {
          // If it's already an MCPError, just rethrow it
          if (error instanceof MCPError) {
            throw error;
          }
          
          if (provider === 'openrouter') {
            throw handleOpenRouterError(error);
          } else {
            throw handleMCPError(error);
          }
        }

        try {
          const stopReason = await this.processStream(stream, provider);
          // Continue only if we used a tool and need another turn AND provider is anthropic
          // OpenRouter doesn't support tool calls in the same way, so we always set to false for OpenRouter
          continueConversation = provider === 'anthropic' ? Boolean(stopReason?.startsWith('tool_use')) : false;
        } catch (error) {
          // If it's already an MCPError, just rethrow it
          if (error instanceof MCPError) {
            throw error;
          }
          
          if (provider === 'openrouter') {
            throw handleOpenRouterError(error);
          } else {
            throw handleMCPError(error);
          }
        }
      }

      return this.messages.slice(1); // don't include the available variables in the response
    } catch (error) {
      if (error instanceof MCPError) {
        console.error('\nError during query processing:', error.message);
        throw error;
      }
      
      const mcpError = provider === 'openrouter' ? 
        handleOpenRouterError(error) : 
        handleMCPError(error);
      
      console.error('\nError during query processing:', mcpError.message);
      if (error instanceof Error) {
        process.stdout.write('I apologize, but I encountered an error: ' + error.message + '\n');
      }
      throw mcpError;
    }
  }
}

function printSafeEnvVars() {
  const envVars = Object.keys(process.env);
  return envVars
    .filter(
      (envVar) =>
        !envVar.toUpperCase().includes('KEY') &&
        !envVar.toUpperCase().includes('TOKEN') &&
        !envVar.toUpperCase().includes('SECRET') &&
        !envVar.toUpperCase().includes('PASSWORD')
    )
    .map((envVar) => `${envVar}=${process.env[envVar]}`)
    .join('\n');
}
