import type { Command, CommandGenerator, CommandOptions } from '../../types.js';
import { loadEnv, loadConfig } from '../../config.js';
import { MCPClientNew } from '../mcp/client/MCPClientNew.js';
import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  MCPAuthError,
  MCPConnectionError,
  MCPServerError,
  MCPToolError,
  MCPConfigError,
} from '../mcp/client/errors.js';
import { getAllProviders } from '../../utils/providerAvailability.js';

// Load environment variables and config
loadEnv();

export class NotionCommand implements Command {
  private config = loadConfig();

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    // Check if NOTION_ACCESS_KEY is set
    if (!process.env.NOTION_ACCESS_KEY) {
      console.error('Error: NOTION_ACCESS_KEY environment variable is not set');
      console.error(
        'Please add your Notion API key to ~/.vibe-tools/.env as NOTION_ACCESS_KEY=...'
      );
      console.error(
        'You can create a Notion integration at https://www.notion.so/profile/integrations'
      );
      console.error('Make sure to share your pages/databases with the integration in Notion');
      return;
    }

    // --- Prepare MCP Configuration ---
    const headers = {
      Authorization: `Bearer ${process.env.NOTION_ACCESS_KEY}`,
      'Notion-Version': '2022-06-28',
    };

    const serverConfig: StdioServerParameters = {
      command: 'npx', // Assuming npx is in PATH
      args: ['-y', '@notionhq/notion-mcp-server'],
      env: {
        ...process.env, // Inherit parent environment
        OPENAPI_MCP_HEADERS: JSON.stringify(headers),
      },
      // cwd: process.cwd(), // Default cwd should be fine
    };

    // Determine LLM provider and model for MCP tool orchestration
    let mcpProvider: 'anthropic' | 'openrouter';

    // Check if user explicitly requested a provider
    const requestedProvider = options.provider;
    if (requestedProvider) {
      // User specified a provider, validate it
      if (requestedProvider === 'anthropic' || requestedProvider === 'openrouter') {
        mcpProvider = requestedProvider;
        if (options.debug) {
          console.log(`Using user-specified provider: ${mcpProvider}`);
        }
      } else {
        console.warn(
          `Warning: Provider '${requestedProvider}' is not supported for MCP commands. Only 'anthropic' and 'openrouter' are supported.`
        );
        // Continue to check config or available providers
        mcpProvider = this.getPreferredProvider();
        if (options.debug) {
          console.log(
            `Using determined provider: ${mcpProvider} (user requested an unsupported provider)`
          );
        }
      }
    } else {
      // Check config or use default logic to pick available provider
      mcpProvider = this.getPreferredProvider();
      if (options.debug) {
        console.log(`Using determined provider: ${mcpProvider}`);
      }
    }

    let mcpModel = options.model ?? this.config.mcp?.model;
    if (!mcpModel) {
      // Default models based on provider
      mcpModel =
        mcpProvider === 'anthropic'
          ? 'claude-3-5-sonnet-latest'
          : 'anthropic/claude-3.5-haiku-20241022'; // Default OpenRouter model
    }

    const llmOptions = {
      provider: mcpProvider,
      model: mcpModel,
      maxTokens: options.maxTokens ?? this.config.mcp?.maxTokens ?? 4096,
    };

    // Instantiate MCPClientNew directly
    const mcpClient = new MCPClientNew(
      {
        ...serverConfig,
        ...llmOptions,
      },
      options.debug ?? false
    );

    try {
      if (options.debug) {
        console.log(
          `Starting Notion MCP server: ${serverConfig.command} ${serverConfig.args?.join(' ')}...`
        );
      }
      await mcpClient.start(); // Starts the server process and initializes tools
      if (options.debug) {
        console.log('Notion MCP client started. Processing query...');
      }

      const results = await mcpClient.processQuery(query);

      if (options.debug) {
        console.log('Query processed by LLM.');
      }

      // Yield the final assistant message
      if (Array.isArray(results)) {
        const lastMessage = results[results.length - 1];
        if (lastMessage?.role === 'assistant') {
          const content =
            typeof lastMessage.content === 'string'
              ? lastMessage.content
              : lastMessage.content
                  .map((item: any) => {
                    if (typeof item === 'object' && item.type === 'text') {
                      return item.text;
                    } else if (typeof item === 'object' && item.type === 'tool_use') {
                      // Don't yield tool use details unless debugging
                      return options.debug ? `\n[Debug: Tool Use Request: ${item.name}]` : '';
                    } else if (typeof item === 'string') {
                      return item;
                    }
                    return JSON.stringify(item);
                  })
                  .join('\n');
          yield content.trim();
        } else {
          // Fallback if the last message wasn't from the assistant
          yield JSON.stringify(results, null, 2);
        }
      } else {
        // Fallback for unexpected result format
        yield JSON.stringify(results, null, 2);
      }
    } catch (error) {
      this.handleError(error, options?.debug);
      // Re-throw the error to ensure the command exits non-zero
      throw error;
    } finally {
      if (options.debug) {
        console.log('Stopping Notion MCP client...');
      }
      await mcpClient.stop(); // Ensures the server process is terminated
      if (options.debug) {
        console.log('Notion MCP client stopped.');
      }
    }
  }

  // Helper method that considers both config and availability
  private getPreferredProvider(): 'anthropic' | 'openrouter' {
    // First check if config specifies a provider
    const configProvider = this.config.mcp?.provider;
    if (configProvider === 'anthropic' || configProvider === 'openrouter') {
      return configProvider;
    }

    // If no config preference or invalid, check availability
    return this.getAvailableProvider();
  }

  // Helper method to determine available provider with priority for OpenRouter
  private getAvailableProvider(): 'anthropic' | 'openrouter' {
    const providers = getAllProviders();

    // Check if OpenRouter is available (our preferred option)
    const openRouterInfo = providers.find((p) => p.provider === 'openrouter');
    if (openRouterInfo?.available) {
      return 'openrouter';
    }

    // Check if Anthropic is available as fallback
    const anthropicInfo = providers.find((p) => p.provider === 'anthropic');
    if (anthropicInfo?.available) {
      return 'anthropic';
    }

    // If we reach here, neither provider is available
    console.log(
      'Warning: Neither OpenRouter nor Anthropic API keys are configured. Will attempt to use OpenRouter.'
    );
    console.log(
      'Please add your API key to ~/.vibe-tools/.env as OPENROUTER_API_KEY=... or ANTHROPIC_API_KEY=...'
    );

    // Default to OpenRouter if neither is available
    // The actual API key check will happen later and appropriate error will be shown
    return 'openrouter';
  }

  // Keep the error handler, slightly simplified as we bypass RunCommand's layers
  private handleError(error: unknown, debug?: boolean) {
    if (error instanceof MCPAuthError) {
      console.error(
        'Authentication error: ' +
          error.message +
          '\nPlease check your NOTION_ACCESS_KEY in ~/.vibe-tools/.env'
      );
    } else if (error instanceof MCPConnectionError) {
      console.error(
        'Connection error: ' +
          error.message +
          '\nPlease check if the Notion MCP server can be started (e.g., npx is available).'
      );
    } else if (error instanceof MCPServerError) {
      console.error(
        'Server error from Notion MCP: ' +
          error.message +
          (error.code ? ` (Code: ${error.code})` : '')
      );
    } else if (error instanceof MCPToolError) {
      console.error(
        'Tool error during Notion interaction: ' +
          error.message +
          (error.toolName ? ` (Tool: ${error.toolName})` : '') +
          '\nPlease check if your Notion integration has access to the requested content.'
      );
    } else if (error instanceof MCPConfigError) {
      // Less likely now, but could happen if SDK options are wrong
      console.error('Internal Configuration error: ' + error.message);
    } else if (error instanceof Error) {
      console.error('Error executing Notion command: ' + error.message);
      if (debug) {
        console.error(error.stack);
      }
    } else {
      console.error('An unknown error occurred during Notion command execution');
    }
  }
}

// Export the command instance
export default new NotionCommand();
