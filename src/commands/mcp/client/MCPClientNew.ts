import { UnifiedLLMClient } from '../../../utils/tool-enabled-llm/unified-client.js';
import { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPError, handleMCPError } from './errors.js';

// InternalMessage interface - matches the one in unified-client.js
export interface InternalMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string | any[];
  tool_call_id?: string;
  name?: string;
  cache_control?: { type: string };
}

export interface MCPClientOptions extends StdioServerParameters {
  provider: 'anthropic' | 'openrouter';
}

const SYSTEM_PROMPT = `You are a helpful AI assistant using tools.
When you receive a tool result, do not call the same tool again with the same arguments unless the user explicitly asks for it or the context changes significantly.
Use the results provided by the tools to answer the user's query.
If you have already called a tool with the same arguments and received a result, reuse the result instead of calling the tool again.
When you receive a tool result, focus on interpreting and explaining the result to the user rather than making additional tool calls.`;

export class MCPClientNew {
  private unifiedClient: UnifiedLLMClient;
  public config: MCPClientOptions;

  constructor(
    serverConfig: MCPClientOptions & { model: string; maxTokens?: number },
    private debug: boolean
  ) {
    this.config = serverConfig;
    const provider = serverConfig.provider;
    const model = serverConfig.model;
    // Initialize the unified client
    this.unifiedClient = new UnifiedLLMClient({
      provider: provider,
      debug: debug,
      mcpMode: true,
      mcpConfig: serverConfig,
      model,
      maxTokens: serverConfig.maxTokens || 8192,
      logger: (message) => {
        console.log(message);
      },
    });
  }

  async start() {
    try {
      console.log('starting mcp client');

      // Start the MCP mode in the unified client
      await this.unifiedClient.startMCP();
    } catch (error) {
      console.error('Failed to initialize MCP Client:', error);
      const mcpError = handleMCPError(error);
      throw mcpError;
    }
  }

  async stop() {
    try {
      // Stop the MCP client in unified client
      await this.unifiedClient.stopMCP();
    } catch (error) {
      const mcpError = handleMCPError(error);
      console.error('Error closing MCP Client:', mcpError);
      throw mcpError;
    }
  }

  async processQuery(query: string) {
    try {
      // Add available variables to the query
      const envVars = printSafeEnvVars();
      const enhancedQuery = `Available variables ${envVars}\n\n${query}`;

      // Process the query using the unified client
      const messages = await this.unifiedClient.processQuery(enhancedQuery, SYSTEM_PROMPT);

      // Return messages, skipping the first one which is just the env vars
      return messages.slice(1);
    } catch (error) {
      console.error('Error during query processing:', error);
      const mcpError = handleMCPError(error);
      console.error('\nError during query processing:', mcpError.message);
      if (this.debug) {
        console.error(mcpError.stack);
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
