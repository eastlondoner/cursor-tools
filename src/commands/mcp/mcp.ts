import type { Command, CommandGenerator, CommandOptions, CommandMap } from '../../types';
import { loadEnv, loadConfig } from '../../config.js';
import {
  MCPAuthError,
  MCPConnectionError,
  MCPServerError,
  MCPToolError,
  MCPConfigError,
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
        console.error(
          'Authentication error: ' +
            error.message +
            '\nPlease check your API key in ~/.vibe-tools/.env'
        )
      );
    } else if (error instanceof MCPConnectionError) {
      console.error(
        console.error(
          'Connection error: ' +
            error.message +
            '\nPlease check if the MCP server is running and accessible.'
        )
      );
    } else if (error instanceof MCPServerError) {
      console.error(
        console.error(
          'Server error: ' +
            error.message +
            (error.code ? ` (Code: ${error.code})` : '') +
            '\nPlease try again later or contact support if the issue persists.'
        )
      );
    } else if (error instanceof MCPToolError) {
      console.error(
        console.error(
          'Tool error: ' +
            error.message +
            (error.toolName ? ` (Tool: ${error.toolName})` : '') +
            '\nPlease check if the tool exists and is properly configured.'
        )
      );
    } else if (error instanceof MCPConfigError) {
      console.error(
        console.error(
          'Configuration error: ' + error.message + '\nPlease check your MCP configuration.'
        )
      );
    } else if (error instanceof Error) {
      console.error(console.error('Error: ' + error.message));
      if (debug) {
        console.error(error.stack);
      }
    } else {
      console.error(console.error('An unknown error occurred'));
    }
  }
}

// Export the command instance
export const mcp = new MCPCommand();
