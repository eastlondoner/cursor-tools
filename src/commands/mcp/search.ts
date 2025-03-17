import type { Command, CommandGenerator, CommandOptions } from '../../types';
import { MarketplaceManager } from './marketplace.js';

export class SearchCommand implements Command {
  constructor(private marketplaceManager: MarketplaceManager) {}

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    if (!query?.trim()) {
      throw new Error('Search query cannot be empty');
    }

    const servers = await this.marketplaceManager.searchServers(query, options);
    if (servers.length === 0) {
      yield 'No servers found matching your query.\n';
      return;
    }

    if (options?.json) {
      yield JSON.stringify(servers, null, 2) + '\n';
      return;
    }

    yield `Found ${servers.length} matching servers:\n\n`;
    for (const server of servers) {
      yield `${server.name}\n`;
      yield `Description: ${server.description}\n`;
      yield `Category: ${server.category}\n`;
      yield `Tags: ${server.tags.join(', ')}\n`;
      yield `GitHub: ${server.githubUrl}\n\n`;
    }
  }
}
