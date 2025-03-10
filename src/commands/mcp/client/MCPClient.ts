import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ChatCompletionTool } from 'openai/resources/chat/completions.mjs';
import { ChatCompletionChunk } from 'openai/resources/chat/completions.mjs';
import {
  StdioClientTransport,
  StdioServerParameters,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { ListToolsResultSchema, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Tool, ToolUseBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import { Stream } from '@anthropic-ai/sdk/streaming.mjs';
import { MCPAuthError, MCPError, handleMCPError } from './errors.js';
import { Stream as OpenAIStream } from 'openai/streaming';

export interface InternalMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string | Array<ToolResult | ToolUseBlockParam>;
  tool_call_id?: string;
  name?: string;
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

export class MCPClient {
  private anthropicClient?: Anthropic = undefined;
  private openrouterClient?: OpenAI = undefined;
  private messages: InternalMessage[] = [];
  private mcpClient: Client;
  private transport: StdioClientTransport;
  private tools: Tool[] | ChatCompletionTool[] = [];
  private toolCalls: ToolCall[] = [];
  public config: MCPClientOptions;

  constructor(
    serverConfig: MCPClientOptions,
    private debug: boolean
  ) {
    this.config = serverConfig;
    const provider = serverConfig.provider || 'anthropic';

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

    this.mcpClient = new Client({ name: 'cli-client', version: '1.0.0' }, { capabilities: {} });
    this.transport = new StdioClientTransport(this.config);
  }

  updateConfig(newConfig: MCPClientOptions) {
    this.config = newConfig;
    this.transport = new StdioClientTransport(this.config);
    this.mcpClient = new Client({ name: 'cli-client', version: '1.0.0' }, { capabilities: {} });
  }

  async start(provider: 'anthropic' | 'openrouter' = 'anthropic') {
    try {
      console.log('starting mcp client');
      await this.mcpClient.connect(this.transport);
      await this.initMCPTools();
    } catch (error) {
      console.error('Failed to initialize MCP Client:', error);
      const mcpError = handleMCPError(error);
      throw mcpError;
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
      
      if (this.openrouterClient) {
        // Convert tools to OpenRouter format
        this.tools = toolsResults.tools.map(tool => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description || "",
            parameters: {
              type: "object",
              properties: tool.inputSchema.properties || {},
              required: tool.inputSchema.required || []
            }
          }
        } as ChatCompletionTool));
      } else {
        // Original Anthropic format
        this.tools = toolsResults.tools.map(({ inputSchema, ...tool }) => ({
          ...tool,
          input_schema: inputSchema,
        }));
      }
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
    stream: Stream<Anthropic.Messages.RawMessageStreamEvent>,
  ): Promise<string | null | undefined> {
    let currentMessage = '';
    let currentToolName = '';
    let currentToolInputString = '';
    let lastStopReason: string | null | undefined;
    let currentToolUseId: string | null = null;
    let lastContent: string | null = null;

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
            }
            lastStopReason = chunk.delta.stop_reason;
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
      return lastStopReason;
    } catch (error) {
      if (!(error instanceof MCPError)) {
        const mcpError = handleMCPError(error);
        console.error('\nError processing stream:', mcpError.message);
        throw mcpError;
      }
      throw error;
    }
  }

  async processQuery(query: string, provider: 'anthropic' | 'openrouter' = 'anthropic', model: string = 'anthropic/claude-3-7-sonnet') {
    try {
      // Reset tool calls for new query
      this.toolCalls = [];
      this.messages = [
        { role: 'user', content: `Available variables ${printSafeEnvVars()}` },
        { role: 'user', content: query },
      ];

      let continueConversation = true;

      while (continueConversation) {    
        let stopReason;
        if (this.openrouterClient) {
          const response = await this.openrouterClient.chat.completions.create({
            messages: this.messages.map(msg => {
              const role = msg.role;
              if (role === 'tool') {
                return {
                  role: role,
                  content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                  tool_call_id: msg.tool_call_id!,
                  name: msg.name!
                };
              }
              return {
                role: role as 'user' | 'assistant',
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              };
            }),
            model: model,
            stream: true,
            tools: this.tools as ChatCompletionTool[],
            max_tokens: 8192,
          });
          stopReason = await this.processOpenRouterStream(response);
        } else if (this.anthropicClient) {
          const stream = await this.anthropicClient.messages.create({
            messages: this.messages.filter(msg => msg.role !== 'tool').map(msg => ({
              role: msg.role as 'user' | 'assistant',
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            })),
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 8192,
            tools: this.tools as Tool[],
            stream: true,
            system: SYSTEM_PROMPT,
          });
          stopReason = await this.processStream(stream);
        } else {
          throw new MCPError('No valid client configured');
        }

        continueConversation = stopReason === 'tool_use';
      }

      return this.messages.slice(1);
    } catch (error) {
      const mcpError = handleMCPError(error);
      console.error('\nError during query processing:', mcpError.message);
      if (error instanceof Error) {
        process.stdout.write('I apologize, but I encountered an error: ' + error.message + '\n');
      }
      throw mcpError;
    }
  }

  private async processOpenRouterStream(stream: OpenAIStream<ChatCompletionChunk>) {
    let currentMessage = '';
    let lastContent: string | null = null;
    let lastStopReason: string | null | undefined;
    let toolCallsInProgress: Map<string, { name: string, arguments: string, id: string }> = new Map();

    try {
      let currentTool = null;
      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices[0]) {
          const choice = chunk.choices[0];
          
          if (choice.delta?.content) {
            currentMessage += choice.delta.content;
            lastContent = currentMessage;
          }

          if (choice.delta?.tool_calls) {
            for (const toolCall of choice.delta.tool_calls) {

              if (toolCall.id) {
                if (!toolCallsInProgress.has(toolCall.id)) {
                  toolCallsInProgress.set(toolCall.id, { name: '', arguments: '', id: toolCall.id });
                }
                currentTool = toolCallsInProgress.get(toolCall.id);
              };
              if (!currentTool) break;

              // Accumulate tool call data
              if (toolCall.function?.name) {
                currentTool.name = toolCall.function.name;
              }
              if (toolCall.function?.arguments) {
                currentTool.arguments += toolCall.function.arguments;
              }
              
              // Try to process the tool call if it seems complete
              if (currentTool.name && currentTool.arguments.endsWith('}')) {
                try {
                  // Store any pending assistant message
                  if (currentMessage) {
                    this.messages.push({ role: 'assistant', content: currentMessage });
                    currentMessage = '';
                  }

                  await this.executeToolCall(currentTool.name, currentTool.arguments);
                  toolCallsInProgress.delete(currentTool.id);
                } catch (error) {
                  if (error instanceof SyntaxError) {
                    // JSON is incomplete, continue accumulating
                    continue;
                  }
                  console.error('Error processing tool call:', error);
                }
              }
            }
          }

          if (choice.finish_reason) {
            lastStopReason = choice.finish_reason;
            if (currentMessage) {
              this.messages.push({ role: 'assistant', content: currentMessage });
              currentMessage = '';
            }
          }
        }
      }
      return lastStopReason;
    } catch (error) {
      const mcpError = handleMCPError(error);
      console.error('\nError processing OpenRouter stream:', mcpError.message);
      throw mcpError;
    }
  }

  private async executeToolCall(toolName: string, argsString: string) {
    try {
      const toolArgs = JSON.parse(argsString);
      const toolUseId = this.generateToolUseId();

      if (this.debug) {
        console.log(`Tool call requested: ${toolName}${this.formatToolCallArgs(toolArgs)}`);
      }

      // Store the tool use request
      this.messages.push({
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: toolUseId,
          name: toolName,
          input: toolArgs,
        }],
      });

      // Execute the tool
      const toolResult = await this.mcpClient.request(
        {
          method: 'tools/call',
          params: { name: toolName, arguments: toolArgs },
        },
        CallToolResultSchema
      );

      // Store the result
      const formattedResult = JSON.stringify(toolResult.content.flatMap((c) => c.text));
      this.messages.push({
        role: 'tool',
        name: toolName,
        tool_call_id: toolUseId,
        content: formattedResult,
      });
    } catch (error) {
      const mcpError = handleMCPError(error);
      console.error('\nError executing tool:', mcpError.message);
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
