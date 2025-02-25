import type { Command, CommandGenerator, CommandOptions, CommandMap } from '../../types';
import { loadEnv, loadConfig } from '../../config.js';
import {
  MCPAuthError,
  MCPConnectionError,
  MCPServerError,
  MCPToolError,
  MCPConfigError,
  MCPConnectionClosedError,
  MCPModelError,
  MCPOpenRouterModelError,
} from './client/errors.js';
import { MarketplaceManager } from './marketplace.js';
import { SearchCommand } from './search';
import { RunCommand } from './run';

// Load environment variables and config
loadEnv();

export class MCPCommand implements Command {
  private config = loadConfig();
  private marketplaceManager = new MarketplaceManager(this.config);
  private subcommands: CommandMap = {
    search: new SearchCommand(this.marketplaceManager),
    run: new RunCommand(this.marketplaceManager),
  };

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    try {
      // Split into subcommand and remaining query
      const [subcommand = 'run', ...rest] = query.split(' ');
      const subQuery = rest.join(' ');

      // Check for provider option
      if (options.provider && typeof options.provider === 'string') {
        if (options.provider !== 'anthropic' && options.provider !== 'openrouter') {
          console.error(`Warning: Unsupported provider '${options.provider}' for MCP. Supported providers are 'anthropic' and 'openrouter'. Using default provider 'anthropic'.`);
          options.provider = 'anthropic';
        }
        
        if (options.provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
          console.error('Warning: OPENROUTER_API_KEY environment variable is not set. Using default provider \'anthropic\'.');
          options.provider = 'anthropic';
        }
      }

      const subCommandHandler = this.subcommands[subcommand];
      if (subCommandHandler) {
        yield* subCommandHandler.execute(subQuery, options);
      } else {
        yield `Unknown MCP subcommand: ${subcommand}. Available subcommands: search, run`;
      }
    } catch (error) {
      this.handleError(error, options?.debug);
      throw error;
    }
  }

  private handleError(error: unknown, debug?: boolean) {
    if (error instanceof MCPAuthError) {
      console.error(
        'Authentication error: ' +
          error.message +
          '\nPlease check your API key in ~/.cursor-tools/.env'
      );
    } else if (error instanceof MCPConnectionClosedError) {
      console.error(
        'Connection closed error: ' +
          error.message +
          (error.serverName ? ` (Server: ${error.serverName})` : '') +
          '\nThis is often due to compatibility issues between the provider and MCP server.'
      );
    } else if (error instanceof MCPConnectionError) {
      console.error(
        'Connection error: ' +
          error.message +
          '\nPlease check if the MCP server is running and accessible.'
      );
    } else if (error instanceof MCPModelError) {
      console.error(
        'Model error: ' +
          error.message +
          (error.model ? ` (Model: ${error.model})` : '') +
          '\nPlease check the model name and ensure it is supported by the provider.'
      );
    } else if (error instanceof MCPOpenRouterModelError) {
      console.error(
        'OpenRouter model error: ' +
          error.message +
          (error.model ? ` (Model: ${error.model})` : '') +
          '\nPlease check the OpenRouter documentation for supported models.'
      );
    } else if (error instanceof MCPServerError) {
      console.error(
        'Server error: ' +
          error.message +
          (error.code ? ` (Code: ${error.code})` : '') +
          '\nPlease try again later or contact support if the issue persists.'
      );
    } else if (error instanceof MCPToolError) {
      console.error(
        'Tool error: ' +
          error.message +
          (error.toolName ? ` (Tool: ${error.toolName})` : '') +
          '\nPlease check if the tool exists and is properly configured.'
      );
    } else if (error instanceof MCPConfigError) {
      console.error(
        'Configuration error: ' + error.message + '\nPlease check your MCP configuration.'
      );
    } else if (error instanceof Error) {
      console.error('Error: ' + error.message);
      if (debug) {
        console.error(error.stack);
      }
    } else {
      console.error('An unknown error occurred');
    }
  }
}

// Export the command instance
export const mcp = new MCPCommand();
