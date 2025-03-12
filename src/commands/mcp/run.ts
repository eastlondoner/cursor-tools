import type { Command, CommandGenerator, CommandOptions } from '../../types';
import { MarketplaceManager, type MCPServer } from './marketplace.js';
import { InternalMessage } from './client/MCPClientNew.js';
import { MCPConfigError } from './client/errors.js';
import { createProvider } from '../../providers/base';
import { once } from '../../utils/once.js';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { MCPClientNew } from './client/MCPClientNew.js';
import { ToolUseBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import { ToolResult } from '../../utils/tool-enabled-llm/unified-client.js';
import { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';

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
      console.log('uvxPath', uvxPath);
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
    const provider = (options.provider as 'anthropic' | 'openrouter') || 'anthropic';
    const model = options.model as string;

    if (provider && provider !== 'anthropic' && provider !== 'openrouter') {
      throw new Error(
        `Invalid provider: ${provider}. Supported providers are 'anthropic' and 'openrouter'`
      );
    }

    if (provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
      throw new Error(
        'OPENROUTER_API_KEY environment variable is required when using the OpenRouter provider'
      );
    }

    // Fetch marketplace data first
    const marketplaceData = await this.marketplaceManager.getMarketplaceData();

    // Select appropriate servers
    let servers = await this.selectServer(queryInput, options, marketplaceData);
    if (!Array.isArray(servers)) {
      // If single server returned, convert to array for consistent handling
      servers = [servers];
    }
    if (servers.length > 3) {
      console.log('More than 3 candidate servers, asking AI to narrow down the selection', servers);
      const query = `I want to choose at most 5 MCP servers from the provided list to satisfy the query '${queryInput}'. Please select the most relevant and likely to run, taking into account the README and that we have the following environment variables <Environment variables>${Object.keys(
        process.env
      )
        .map((key) => `${key}`)
        .join(
          '\n'
        )}</Environment variables>. Choose the most likely to run. Return no more than 5 MCP servers.`;
      servers = await this.selectServer(query, options, { servers });
      if (!Array.isArray(servers)) {
        // If single server returned, convert to array for consistent handling
        servers = [servers];
      }
      if (servers.length > 5) {
        servers = servers.slice(0, 5);
      }
    }

    if (servers.length === 0) {
      throw new Error('No suitable MCP servers found for the query');
    }
    servers = servers.filter((s) => !!s.readme?.trim());
    if (servers.length === 0) {
      throw new Error('No servers found with a README.md file');
    }

    yield `Found ${servers.length} matching MCP server(s):\n${servers.map((s) => `- ${s.name}`).join('\n')}\n`;

    // Track successful clients for final processing
    const maxAttempts = 5;
    // Try to initialize each server with retries
    const serverResults = await Promise.all(
      servers.map(async (server) => {
        let query = queryInput;
        const yields: string[] = [];
        yields.push(`\nAttempting to initialize ${server.name}...\n`);

        let attempts = 0;
        let lastError = '';
        let success = false;

        while (attempts < maxAttempts && !success) {
          let serverConfig: {
            command: string;
            args: string[];
            env: Record<string, string>;
          } | null = null;
          try {
            // Generate initial arguments using AI

            try {
              serverConfig = await this.generateMCPConfig(query, server, options, {
                fail: attempts === maxAttempts - 1,
              });
            } catch (error) {
              yields.push(`Error generating arguments for ${server.name}: ${error}\n`);
              // these shouldbreak out of the loop
              return { type: 'failure' as const, server, error: error, yields };
            }
            yields.push(
              `Generated arguments for ${server.name}: ${JSON.stringify({ ...serverConfig, env: removeEnvValues(serverConfig.env) })}\n`
            );

            // Initialize client with selected server and generated args
            const client = new MCPClientNew(
              {
                command: serverConfig.command,
                args: serverConfig.args,
                env: serverConfig.env,
                provider: provider,
                model: model,
              },
              options.debug
            );
            await client.start();
            success = true;
            yields.push(`Successfully initialized ${server.name}\n`);
            return { type: 'success' as const, client, server, yields };
          } catch (error) {
            attempts++;
            lastError = error instanceof Error ? error.message : String(error);
            console.error(`Attempt ${attempts} for ${server.name} failed`, lastError);
            if (attempts < maxAttempts) {
              yields.push(
                `Attempt ${attempts} for ${server.name} failed with error: ${lastError}. Retrying with error feedback...\n`
              );
              // Regenerate config with error feedback
              query = `${query}\n\nPrevious attempt failed with configuration: ${JSON.stringify({ ...serverConfig, env: removeEnvValues(serverConfig?.env ?? {}) }, null, 2)}\nError: ${lastError}`;
              if (options.debug) {
                console.log('query', query);
              }
            } else {
              yields.push(
                `⚠️ Failed to initialize ${server.name} after ${maxAttempts} attempts. Last error: ${lastError}\n`
              );
              return { type: 'failure' as const, server, error: lastError, yields };
            }
          }
        }
        // This should never happen due to the while loop condition, but TypeScript needs it
        return { type: 'failure' as const, server, error: lastError, yields };
      })
    );

    // // Yield all collected messages
    // for (const result of serverResults) {
    //   for (const message of result.yields) {
    //     yield message;
    //   }
    // }

    // Process results to get successful and failed servers
    const successfulClients = serverResults.filter(
      (
        result
      ): result is { type: 'success'; client: MCPClientNew; server: MCPServer; yields: string[] } =>
        result.type === 'success'
    );
    const failedServers = serverResults.filter(
      (result): result is { type: 'failure'; server: MCPServer; error: string; yields: string[] } =>
        result.type === 'failure'
    );

    // If no servers succeeded, throw error
    if (successfulClients.length === 0) {
      // log all yields
      for (const result of serverResults) {
        for (const msg of result.yields) {
          console.log(`${result.server.name}: ${msg}`);
        }
      }

      // Build detailed error message with READMEs
      const errorMessage = [
        `Failed to initialize any MCP servers after ${maxAttempts} attempts each.`,
        '\nServer READMEs:',
        ...failedServers.map((f) =>
          [
            `\n=== ${f.server.name} README ===`,
            f.server.readme?.trim() || '(No README available)',
            `=== End of ${f.server.name} README ===\n`,
          ].join('\n')
        ),
        '\nFailed servers and their errors:',
        ...failedServers.map((f) => `- ${f.server.name}: ${f.error}`),
      ].join('\n');

      throw new Error(errorMessage);
    }

    // If some servers failed but others succeeded, log warning
    if (failedServers.length > 0) {
      yield `\n⚠️ Warning: ${failedServers.length} server(s) failed to initialize:\n${failedServers
        .map((f) => `- ${f.server.name}`)
        .join(
          '\n'
        )}\n\nContinuing with ${successfulClients.length} successful server(s)\n${successfulClients.map((c) => `- ${c.server.name}`).join('\n')}\n\n`;
    }

    try {
      // Process query with all successful clients
      const allMessages = await Promise.all(
        successfulClients.map(async ({ client, server }) => {
          try {
            const messages = await client.processQuery(queryInput);
            return { server, messages, error: null };
          } catch (error) {
            return {
              server,
              messages: null,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      // Handle save-to option if specified
      if (options?.saveTo) {
        const fs = await import('node:fs/promises');
        await fs.writeFile(
          options.saveTo,
          JSON.stringify(
            allMessages.filter((m) => m.messages !== null),
            null,
            2
          )
        );
        yield `Output saved to ${options.saveTo}\n`;
      }

      // Yield messages from each successful client
      for (const result of allMessages) {
        if (result.error) {
          yield `\n⚠️ Error processing query with ${result.server.name}: ${result.error}\n`;
        } else if (result.messages) {
          yield `\n=== Results from ${result.server.name} ===\n`;
          for (const message of result.messages) {
            const msg = stringifyMessage(message.content, { debug: options.debug });
            if (msg.trim()) {
              yield msg;
            }
          }
          yield `\n=== End of ${result.server.name} ===\n`;
        }
      }
    } finally {
      // Clean up all clients
      await Promise.all(successfulClients.map(({ client }) => client.stop()));
    }
  }
}

function stringifyMessage(
  message:
    | string
    | Array<ToolResult | ToolUseBlockParam | TextBlockParam>
    | ToolResult
    | ToolUseBlockParam
    | TextBlockParam,
  { debug }: { debug: boolean }
): string {
  if (typeof message === 'string') {
    return message + '\n';
  }
  if (Array.isArray(message)) {
    return message.map((m) => stringifyMessage(m, { debug })).join('\n');
  }
  if ('type' in message && message.type === 'text') {
    return message.text;
  }
  if ('type' in message && message.type === 'tool_result') {
    if (debug) {
      return `Tool result: ${message.content}`;
    }
    return '';
  }
  if ('type' in message && message.type === 'tool_use') {
    if (debug) {
      return `Tool use: ${message.name}`;
    }
    return '';
  }
  return JSON.stringify(message, null, 2);
}

function removeEnvValues(env: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, _] of Object.entries(env)) {
    output[key] = 'REDACTED'; // redact env vars
  }
  return output;
}
