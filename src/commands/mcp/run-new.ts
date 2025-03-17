import type { Command, CommandGenerator, CommandOptions } from '../../types';
import { MarketplaceManager, type MCPServer } from './marketplace.js';
import { MCPConfigError } from './client/errors.js';
import { createProvider } from '../../providers/base';
import { once } from '../../utils/once.js';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import {
  UnifiedLLMClient,
  type InternalMessage,
} from '../../utils/tool-enabled-llm/unified-client.js';

const execFile = promisify(execFileCallback);

function populateEnv(requiredEnv: Record<string, string>): Record<string, string> {
  const populatedEnv: Record<string, string> = {};

  for (const [key, _] of Object.entries(requiredEnv)) {
    // Otherwise check process.env
    const envValue = process.env[key];
    if (!envValue) {
      throw new MCPConfigError(`Required environment variable "${key}" is not set`);
    }

    populatedEnv[key] = envValue;
  }

  populatedEnv['PATH'] = process.env.PATH || '';
  return populatedEnv;
}

const pathToUvx = once(async (): Promise<string> => {
  try {
    const { stdout } = await execFile('which', ['uvx']);
    const uvxPath = stdout.trim();
    if (uvxPath) {
      return uvxPath;
    }
  } catch (error) {
    console.error('Error finding uvx:', error);
  }
  return 'uvx';
});

const pathToNpx = once(async (): Promise<string> => {
  try {
    const { stdout } = await execFile('which', ['npx']);
    const npxPath = stdout.trim();
    if (npxPath) {
      console.log('npxPath', npxPath);
      return npxPath;
    }
  } catch (error) {
    console.error('Error finding npx:', error);
  }
  return 'npx';
});

const SYSTEM_PROMPT = `You are a helpful AI assistant. You have access to tools that you can use to accomplish tasks. Use these tools to help the user fulfill their request. If needed, you may break down complex tasks into simpler tool executions. Always respond in a helpful, safe, and ethical manner. Engage with all questions, instructions, and tasks to the best of your ability, adapting your approach based on the nature of the request.

Be flexible, break down complex tasks and tackle them step by step. If the tools available are insufficient, explain why and suggest alternative approaches. When dealing with data returned from tools, ensure it's formatted clearly and analyze it to provide useful insights.

You should ask clarifying questions when faced with ambiguous requests, and be attentive to the user's preferences and priorities.

Always provide your reasoning for the actions you take, explaining your approach and the limitations of your tools. This transparency helps the user understand your process and refine their requests.

For sensitive or ethical issues, take a balanced approach, acknowledging different viewpoints while maintaining ethical principles. When in doubt, present information with appropriate caveats, helping the user make informed judgments.

When handling complex or multi-part tasks, break your response into clear sections, maintaining a conversational tone throughout. Remember that your goal is not just to execute tools but to solve problems and provide useful information. Above all, make the user's goals your top priority and adapt your approach accordingly.`;

export class RunCommand implements Command {
  constructor(private marketplaceManager: MarketplaceManager) {}

  private async selectServer(
    query: string,
    options: CommandOptions,
    marketplaceData: { servers: MCPServer[] }
  ): Promise<MCPServer[]> {
    // Find servers based on intent
    const servers = await this.marketplaceManager.findServersForIntent(query, options);
    if (servers.length === 0) {
      throw new MCPConfigError('No suitable servers found for the given query');
    }

    return servers;
  }

  private async generateMCPConfig(
    query: string,
    server: MCPServer,
    options: CommandOptions,
    { fail }: { fail: boolean }
  ): Promise<{
    command: 'uvx' | 'npx';
    args: string[];
    env: Record<string, string>;
  }> {
    // Use Gemini to generate appropriate arguments
    const provider = createProvider('gemini');

    const { readme, ...serverDetails } = server;
    const prompt = `You are an expert engineer. Your job is to create json configurations for running MCP servers based on the README of the given mcp server, and the user query.

IMPORTANT: You must return a JSON object in EXACTLY this format:
{
  "mcpServers": {
    "<mcpServerId>": {
      "command": "<uvx | npx>",
      "args": ["<uvx | npx flags>" "<server package name or github ref>", "<server argument 1>", "<server argument 2>", ...],
      "env": {
        "<env var name>": "YOUR_ENV_VAR_VALUE"
      }
    }
  }
}

Do not return an array or any other format. The response must be a JSON object with a "mcpServers" key containing a "git" key with "command" and "args" properties.

The <server package name> argument MUST exactly match the command in the README.md file for the given mcp server.
Given a user query and the mcp server details, generate the appropriate mcp server configuration as a json object. Make sure to identify placeholders in README commands such as /path/to/file and replace them with user provided values. Do not return placeholders in the response.

Python servers that are hosted on github can be run with command: "uvx", args: ["--from", "git+https://github.com/<user>/<repo>@[ref]", "<module name>", ...remaining_args] however running args: ["<pypi package name>", ...remaining_args] is preffered and works for anything that has pip install <pypi package name> instructions.
Node servers that are hosted on github can be run with npx using command: "npx", args: ["-y", "github:<user>/<repo>#[ref]", ...remaining_args] however running with npx <npm package name> is preferred.

Note the current directory is '${process.cwd()}' you can use this as a path for inputs and outputs.
The command should always be "uvx" (for python servers) or "npx" (for node servers). Do not attempt to run python servers with npx or node servers with uvx. Note the uv command with --directory cannot be used as it requires checking out the source code for the server which is not practical.

IMPORTANT: If this is a retry attempt with an error message, analyze the error and adjust the configuration accordingly. Try running the command from the github ref if previously tried with the package name. With uvx try specifying a python version explicity by adding "--python", "<version e.g. 3.12 | 3.13>" to the args. Do not repeat the same configurations that have already been tried.

User Query: "${query}"

Note: our job is just to start the server. Performing any tasks that the user has requested with the server will come in a later step.

<Server Details>
${JSON.stringify(serverDetails, null, 2)}
</Server Details>

<README>
${readme}
</README>

Check the required environment variables against the available environment variables below. If any required environment variables mentioned in the README are not available, particularly API keys, respond with a json object with the key "needsMoreInfo" and the value being a string of the information you need.

<Available Environment Variables>
${Object.keys(process.env)
  .map((key) => `${key}`)
  .join('\n')}
</Available Environment Variables>

${fail ? 'Please return a json object with the key "needsMoreInfo" and the value being a string explaining the error and what further information you need that might help create a valid configuration. Do not return any other text.' : 'Return ONLY a JSON object in the exact format shown above. DO NOT include markdown formatting, backticks, or any other text. Just the raw JSON object.'}

HOWEVER if the server details show that you cannot run with uvx or npx, or if you need more information from the user that is not included in the user query, respond with a json object with the key "needsMoreInfo" and the value being a string of the information you need.`;

    try {
      const response = await provider.executePrompt(prompt, {
        model: 'gemini-2.0-flash',
        maxTokens: 1000,
        systemPrompt:
          'You are an expert at generating MCP server arguments. You only return a raw JSON object, no markdown, no backticks, no other text.',
        debug: options.debug,
      });

      // Clean the response of any markdown formatting
      const cleanedResponse = response.replace(/```(?:json)?\n([\s\S]*?)\n```/g, '$1').trim();

      // Parse the response and ensure it's an array of strings
      let args = JSON.parse(cleanedResponse);
      if (options.debug) {
        console.log(
          'server config',
          JSON.stringify({ ...args, env: Object.keys(args.env ?? {}) }, null, 2)
        );
      }
      if (Array.isArray(args) && (args[0] === 'uvx' || args[0] === 'npx')) {
        args = {
          mcpServers: {
            git: {
              command: args[0],
              args: args.slice(1),
            },
          },
        };
      }

      if (args.needsMoreInfo) {
        throw new Error(
          `We need more information from you to generate the MCP server configuration. Please re run the command provide the following information: ${args.needsMoreInfo}`
        );
      }

      const keys = Object.keys(args.mcpServers);
      if (!keys || keys.length !== 1) {
        throw new Error('Invalid argument format returned by AI, unexpected number of keys');
      }

      // If server has hardcoded args from an override, use those directly
      if (server.command && server.args) {
        console.log('Using hardcoded configuration from override for server', server.name);
        return {
          command: server.command === 'uvx' ? 'uvx' : 'npx',
          args: server.args,
          env: populateEnv(args.env ?? {}), // Preserve environment variables
        };
      }

      const serverName = keys[0];
      const serverConfig = args.mcpServers[serverName];

      if (serverConfig.command !== 'uvx' && serverConfig.command !== 'npx') {
        throw new Error(`Invalid command returned by AI: ${serverConfig.command}`);
      }
      if (!Array.isArray(serverConfig.args)) {
        throw new Error('Invalid args returned by AI');
      }

      if (serverConfig.command !== 'uvx' && serverConfig.command !== 'npx') {
        throw new Error('Invalid command returned by AI');
      }

      const env = 'env' in serverConfig ? serverConfig.env : {};

      switch (serverConfig.command) {
        case 'uvx':
          serverConfig.command = await pathToUvx();
          if (serverConfig.args?.[0] === 'run') {
            serverConfig.args.shift(); // sometimes uv run can be dealy with by uvx
          }
          for (let i = 0; i < serverConfig.args.length; i++) {
            // bug: https://github.com/pashpashpash/mcp-discord/pull/1
            if (serverConfig.args[i] === 'mcp_discord') {
              serverConfig.args[i] = 'mcp-discord';
            }
          }
          break;
        case 'npx':
          serverConfig.command = await pathToNpx();
          if (serverConfig.args?.[0].startsWith('github.com/')) {
            serverConfig.args[0] = serverConfig.args[0].replace('github.com/', 'github:');
          }
          if (serverConfig.args?.[0] !== '-y') {
            serverConfig.args.unshift('-y');
          }
          break;
        default:
          throw new Error('Invalid command returned by AI: ' + serverConfig.command);
      }
      return {
        command: serverConfig.command,
        args: serverConfig.args,
        env: populateEnv(env),
      };
    } catch (error) {
      console.error('Error generating MCP config:', error);
      // If we fail to generate arguments, return default args or empty array if no defaults
      throw error;
    }
  }

  async *execute(queryInput: string, options: CommandOptions): CommandGenerator {
    if (!queryInput?.trim()) {
      throw new Error('Query cannot be empty');
    }

    // Extract provider option if specified
    let provider = (options.provider as 'anthropic' | 'openrouter') || 'anthropic';
    if (provider !== 'anthropic' && provider !== 'openrouter') {
      console.log(`Provider ${provider} not supported for MCP commands, falling back to anthropic`);
      provider = 'anthropic';
    }

    try {
      // Get marketplace data
      const marketplaceData = await this.marketplaceManager.getMarketplaceData();

      // Find servers based on intent
      const servers = await this.selectServer(queryInput, options, marketplaceData);
      if (servers.length === 0) {
        throw new MCPConfigError('No suitable servers found for the given query');
      }

      // Take the first server
      const server = servers[0];
      yield `Using MCP server: ${server.name} (${server.description})\n`;

      // Generate arguments and environment variables for running the server
      let serverCommandInfo;
      try {
        serverCommandInfo = await this.generateMCPConfig(queryInput, server, options, {
          fail: false,
        });
      } catch (error) {
        if (error instanceof Error) {
          yield `Error generating server configuration: ${error.message}\n`;
          throw error;
        }
        throw error;
      }

      const { command, args, env } = serverCommandInfo;

      // Start the server
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        yield `Starting MCP server (${command} ${args.join(' ')})...\n`;

        try {
          const mcpClient = new UnifiedLLMClient({
            provider,
            model: options.model as string,
            debug: options.debug,
            mcpMode: true,
            mcpConfig: {
              command,
              args,
              cwd: process.cwd(),
              env,
            },
            maxTokens: 8192,
            logger: (message) => yield message,
          });

          // Start the MCP client and initialize tools
          await mcpClient.startMCP();

          // Process the user query
          const messages = await mcpClient.processQuery(queryInput, SYSTEM_PROMPT);

          // Stop the MCP client
          await mcpClient.stopMCP();

          // Return the last message from the model
          for (const message of messages) {
            if (message.role === 'assistant') {
              const content =
                typeof message.content === 'string'
                  ? message.content
                  : message.content
                      .map((item) => {
                        if (typeof item === 'object' && item.type === 'text') {
                          return item.text;
                        }
                        return JSON.stringify(item);
                      })
                      .join('\n');

              yield content;
            }
          }

          return;
        } catch (error) {
          console.error(`Error on attempt ${retries + 1}:`, error);
          retries++;

          if (retries < maxRetries) {
            yield `Error running MCP server, retrying (${retries}/${maxRetries})...\n`;

            // Try to regenerate the config with error context
            try {
              serverCommandInfo = await this.generateMCPConfig(queryInput, server, options, {
                fail: true,
              });
              // Update with new command info
              Object.assign({ command, args, env }, serverCommandInfo);
            } catch (configError) {
              console.error('Failed to regenerate MCP config:', configError);
              // Continue with the same config if regeneration fails
            }
          } else {
            yield `Failed to run MCP server after ${maxRetries} attempts.\n`;
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Error executing MCP query:', error);
      if (options.debug) {
        console.error(error);
      }
      throw error;
    }
  }
}
