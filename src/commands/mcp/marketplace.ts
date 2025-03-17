import { NetworkError } from '../../errors';
import { Config } from '../../types';
import { createProvider } from '../../providers/base';
import { once } from '../../utils/once';

export interface MCPServer {
  // Marketplace metadata
  mcpId: string;
  githubUrl: string;
  name: string;
  author: string;
  description: string;
  codiconIcon: string;
  logoUrl: string;
  category: string;
  tags: string[];
  requiresApiKey: boolean;
  isRecommended: boolean;
  githubStars: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  readme?: string; // Optional README content

  // Server execution details
  command: 'uvx' | 'npx';
  args: string[];
}

export interface MarketplaceData {
  servers: MCPServer[];
}

const fetchFromMCPDirectory = once(async (): Promise<MarketplaceData> => {
  console.log('Fetching MCP servers from marketplace...');

  try {
    const response = await fetch('https://api.cline.bot/v1/mcp/marketplace');
    if (!response.ok) {
      throw new NetworkError(`Failed to fetch marketplace data: ${response.statusText}`);
    }

    const data = await response.json();
    return { servers: data };
  } catch (error) {
    console.error('Error fetching from MCP directory:', error);
    throw error;
  }
});

// Hardcoded overrides for specific MCP servers
const MCP_OVERRIDES: Record<string, Partial<MCPServer>> = {};

export class MarketplaceManager {
  constructor(private config: Config) {}

  private getOverrides(): Record<string, Partial<MCPServer>> {
    // Start with hardcoded overrides
    const overrides = { ...MCP_OVERRIDES };

    // Merge with config overrides if they exist
    if (this.config.mcp?.overrides) {
      for (const [mcpId, override] of Object.entries(this.config.mcp.overrides)) {
        if (mcpId in overrides) {
          console.log(`Warning: Config override for ${mcpId} is overriding a hardcoded override`);
        }
        overrides[mcpId] = override;
      }
    }

    return overrides;
  }

  async getMarketplaceData(): Promise<MarketplaceData> {
    const data = await fetchFromMCPDirectory();

    // Apply overrides
    const overrides = this.getOverrides();
    const servers = data.servers.map((server) => {
      const override = overrides[server.mcpId];
      if (override) {
        console.log(`Applying override for MCP server: ${server.mcpId}`);
        return {
          ...server,
          ...override,
        };
      }

      return server;
    });

    return { servers: await Promise.all(servers) };
  }

  async findServersForIntent(query: string, options: { debug: boolean }): Promise<MCPServer[]> {
    const matches = await this.searchServers(query, options);
    return matches;
  }

  private async fetchReadmeContent(githubUrl: string): Promise<string | null> {
    try {
      // example github url https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab

      const [root, treePath] = githubUrl.split('/tree/', 2);

      let paths = [];
      if (treePath) {
        paths.push(treePath);
      } else {
        paths.push('main', 'master', 'develop');
      }

      // Try common README file patterns
      const readmePatterns = ['README.md', 'README', 'Readme.md', 'readme.md'];

      for (const path of paths) {
        for (const pattern of readmePatterns) {
          const readmeUrl = `${root.replace('github.com', 'raw.githubusercontent.com')}/${path}/${pattern}`;
          console.log('Attempting to fetch README from', readmeUrl);

          const response = await fetch(readmeUrl);
          if (response.ok) {
            return await response.text();
          }
        }
      }

      console.log(`No README found for ${githubUrl}`);
      return null;
    } catch (error) {
      console.error(`Error fetching README for ${githubUrl}:`, error);
      return null;
    }
  }

  async searchServers(query: string, options: { debug: boolean }): Promise<MCPServer[]> {
    const marketplaceData = await this.getMarketplaceData();

    // Use Gemini to find semantic matches
    const provider = createProvider('gemini');

    const prompt = `You are a semantic search expert. Given a list of MCP servers and a search query, return ONLY the mcpIds of servers that are very likely to be able to satisfy the users request or query.
Do not include any explanation or other text, just return a JSON array of mcpId strings. If there are no suitable servers, return an empty json array.

Search Query: "${query}"

Available Servers:
${JSON.stringify(marketplaceData.servers, null, 2)}`;

    try {
      const response = await provider.executePrompt(prompt, {
        model: this.config.marketplace?.model || 'gemini-2.0-flash',
        maxTokens: 1000,
        systemPrompt:
          'You are a semantic search expert that helps find the most relevant MCP servers based on user queries. You only return mcpIds as a comma separated list, no other text.',
        debug: options.debug,
      });

      // Parse the response by removing all possible formatting characters and splitting on commas
      const matchingIds = new Set(
        response
          .replace(/[[\](){}"'`]/g, '') // Remove all brackets, braces, quotes
          .replace(/\s+/g, ' ') // Normalize whitespace
          .split(',')
          .map((id) => id.trim().toLowerCase())
          .filter((id) => id.length > 0)
      ); // Remove empty entries

      // Get matching servers and fetch their READMEs
      const matchingServers = marketplaceData.servers.filter(
        (server) =>
          matchingIds.has(server.mcpId.toLowerCase()) ||
          matchingIds.has(server.githubUrl.toLowerCase())
      );

      // Fetch READMEs for all matching servers in parallel
      const serversWithReadme = await Promise.all(
        matchingServers.map(async (server) => {
          const readme = await this.fetchReadmeContent(server.githubUrl);
          if (!readme) {
            console.log(`No README found for ${server.githubUrl}`);
          }
          return {
            ...server,
            readme: readme || undefined, // Only include readme if it was found
          };
        })
      );

      return serversWithReadme;
    } catch (error) {
      console.error('Error using Gemini for semantic search, falling back to text search:', error);
      throw error;
    }
  }
}
