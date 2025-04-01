import type { Command, CommandGenerator, CommandOptions, Provider, Config } from '../types';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadEnv } from '../config';
import { CURSOR_RULES_TEMPLATE, checkCursorRules } from '../cursorrules';

interface JsonInstallOptions extends CommandOptions {
  json?: string | boolean;
}

// Helper function to get user input and properly close stdin
async function getUserInput(prompt: string): Promise<string> {
  return new Promise<string>((resolve) => {
    process.stdout.write(prompt);
    const onData = (data: Buffer) => {
      const input = data.toString().trim();
      process.stdin.removeListener('data', onData);
      process.stdin.pause();
      resolve(input);
    };
    process.stdin.resume();
    process.stdin.once('data', onData);
  });
}

// Valid providers that cursor-tools supports
// Note: The case here is important as it's used to normalize user input to the expected format
const VALID_PROVIDERS = ['Openrouter', 'Perplexity', 'Openai', 'Anthropic', 'Modelbox', 'Gemini'];
const VALID_PROVIDERS_LOWERCASE = VALID_PROVIDERS.map((p) => p.toLowerCase());

// Helper to parse JSON configuration
function parseJsonConfig(
  jsonString: string
): Record<string, { provider: Provider; model: string }> {
  try {
    const parsedConfig = JSON.parse(jsonString);

    // Validate that each provider is valid
    for (const [key, value] of Object.entries(parsedConfig)) {
      const providerObj = value as { provider: string; model: string };

      if (!providerObj.provider) {
        throw new Error(`Missing provider in configuration for "${key}"`);
      }

      // Case-insensitive check for provider
      if (!VALID_PROVIDERS_LOWERCASE.includes(providerObj.provider.toLowerCase())) {
        throw new Error(
          `Invalid provider "${providerObj.provider}" in configuration for "${key}". Valid providers are: ${VALID_PROVIDERS.join(', ')}`
        );
      }

      if (!providerObj.model) {
        throw new Error(`Missing model in configuration for "${key}"`);
      }

      // Normalize provider case to match expected format
      const providerIndex = VALID_PROVIDERS_LOWERCASE.indexOf(providerObj.provider.toLowerCase());
      providerObj.provider = VALID_PROVIDERS[providerIndex];
    }

    return parsedConfig as Record<string, { provider: Provider; model: string }>;
  } catch (error) {
    throw new Error(
      `Invalid JSON configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Collect unique providers from JSON configuration
function collectRequiredProviders(
  config: Record<string, { provider: Provider; model: string }>
): Provider[] {
  const providers = new Set<Provider>();

  Object.values(config).forEach(({ provider }) => {
    // Provider should already be normalized to correct case from parseJsonConfig
    providers.add(provider);
  });

  return Array.from(providers);
}

export class JsonInstallCommand implements Command {
  private async *setupApiKeys(requiredProviders: Provider[]): CommandGenerator {
    loadEnv(); // Load existing env files if any

    const homeEnvPath = join(homedir(), '.cursor-tools', '.env');
    const localEnvPath = join(process.cwd(), '.cursor-tools.env');

    try {
      // Welcome message
      yield '\n===============================================================\n';
      yield '           Welcome to Vibe-Tools!              \n';
      yield '===============================================================\n\n';

      // Create a list of all keys to collect
      const keys: Record<string, string> = {};

      // Show all available providers that need to be configured
      yield 'Based on your configuration, we need keys for the following providers:\n';
      for (const provider of requiredProviders) {
        yield `- ${provider}\n`;
      }

      yield '\nEnter API keys for the providers you want to use (press Enter to skip any):\n';

      // Now ask for each required provider
      for (const provider of requiredProviders) {
        const envKey = `${provider.toUpperCase()}_API_KEY`;
        const currentValue = process.env[envKey];

        if (currentValue) {
          yield `Using existing ${provider} API key from environment.\n`;
          keys[envKey] = currentValue;
        } else {
          // Show which provider is required by the configuration
          const key = await getUserInput(`${provider} API key (required by your config): `);
          keys[envKey] = key;
        }
      }

      // Check if user provided at least one key
      const hasAtLeastOneKey = Object.values(keys).some((value) => !!value);

      if (!hasAtLeastOneKey) {
        yield '\nWarning: No API keys provided. You will need to set up keys manually to use cursor-tools with your configuration.\n';
      }

      // Write keys to file
      const writeKeysToFile = (filePath: string, keys: Record<string, string>) => {
        let existingEnvVars: Record<string, string> = {};
        if (existsSync(filePath)) {
          try {
            const existingContent = readFileSync(filePath, 'utf-8');
            existingContent.split('\n').forEach((line) => {
              line = line.trim();
              if (!line || line.startsWith('#')) return;

              const eqIndex = line.indexOf('=');
              if (eqIndex !== -1) {
                const key = line.slice(0, eqIndex).trim();
                let value = line.slice(eqIndex + 1).trim();
                if (
                  (value.startsWith('"') && value.endsWith('"')) ||
                  (value.startsWith("'") && value.endsWith("'"))
                ) {
                  value = value.slice(1, -1);
                }
                if (key) {
                  existingEnvVars[key] = value;
                }
              }
            });
          } catch (error) {
            console.error(`Warning: Error reading existing .env file at ${filePath}:`, error);
          }
        }

        // Merge new keys with existing ones
        const mergedKeys = {
          ...existingEnvVars,
          ...Object.fromEntries(Object.entries(keys).filter(([_, value]) => value)),
        };

        const envContent =
          Object.entries(mergedKeys)
            .map(([key, value]) => {
              const normalizedValue = String(value);
              const escapedValue = normalizedValue.replace(/(?<!\\)"/g, '\\"');
              return `${key}="${escapedValue}"`;
            })
            .join('\n') + '\n';

        const dir = join(filePath, '..');
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(filePath, envContent, 'utf-8');
      };

      // Try to write to home directory first, fall back to local if it fails
      try {
        writeKeysToFile(homeEnvPath, keys);
        yield '\nAPI keys written to ~/.cursor-tools/.env\n';
      } catch (error) {
        console.error('Error writing API keys to home directory:', error);
        writeKeysToFile(localEnvPath, keys);
        yield '\nAPI keys written to .cursor-tools.env in the current directory\n';
      }
    } catch (error) {
      console.error('Error setting up API keys:', error);
      yield 'Error setting up API keys. You can add them later manually.\n';
    }
  }

  private async createConfig(
    jsonConfig: Record<string, { provider: Provider; model: string }>
  ): Promise<void> {
    const config: Config = {
      web: {},
      plan: {
        fileProvider: 'gemini',
        thinkingProvider: 'openai',
      },
      repo: {
        provider: 'gemini',
      },
      doc: {
        provider: 'perplexity',
      },
    };

    // Map the JSON config to the actual config structure
    for (const [key, value] of Object.entries(jsonConfig)) {
      switch (key) {
        case 'coding':
          config.repo = {
            provider: value.provider,
            model: value.model,
          };
          break;
        case 'tooling':
          config.plan = {
            fileProvider: value.provider,
            thinkingProvider: value.provider,
            fileModel: value.model,
            thinkingModel: value.model,
          };
          break;
        case 'websearch':
          config.web = {
            provider: value.provider,
            model: value.model,
          };
          break;
        case 'largecontext':
          // This could apply to several commands that need large context
          if (!config.doc) config.doc = { provider: 'perplexity' };
          config.doc.provider = value.provider;
          config.doc.model = value.model;
          break;
      }
    }

    const homeConfigPath = join(homedir(), '.cursor-tools', 'config.json');
    const localConfigPath = join(process.cwd(), 'cursor-tools.config.json');

    // Create directory if it doesn't exist
    const homeConfigDir = join(homedir(), '.cursor-tools');
    if (!existsSync(homeConfigDir)) {
      mkdirSync(homeConfigDir, { recursive: true });
    }

    // Ask user where to save the config
    console.log('\nWhere would you like to save the configuration?');
    console.log('1) Global config (~/.cursor-tools/config.json)');
    console.log('2) Local config (./cursor-tools.config.json)');

    const answer = await getUserInput('Enter choice (1 or 2): ');
    const configPath = answer === '2' ? localConfigPath : homeConfigPath;

    try {
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`\nConfig saved to ${configPath}`);
    } catch (error) {
      console.error(`Error writing config to ${configPath}:`, error);
      throw error;
    }
  }

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    const targetPath = query || '.';
    const absolutePath = join(process.cwd(), targetPath);

    if (typeof options.json !== 'string') {
      throw new Error('JSON configuration is required for this command');
    }

    try {
      // Parse JSON configuration
      const jsonConfig = parseJsonConfig(options.json);

      // Identify required providers
      const requiredProviders = collectRequiredProviders(jsonConfig);

      // Setup API keys
      yield 'Setting up API keys for required providers...\n';
      for await (const message of this.setupApiKeys(requiredProviders)) {
        yield message;
      }

      // Create config file
      yield '\nCreating configuration file...\n';
      await this.createConfig(jsonConfig);

      // Update/create cursor rules
      try {
        yield '\nSetting up cursor rules...\n';

        // Always use new directory structure for rules with JSON installer
        process.env.USE_LEGACY_CURSORRULES = 'false';

        // Create necessary directories
        const rulesDir = join(absolutePath, '.cursor', 'rules');
        if (!existsSync(rulesDir)) {
          try {
            mkdirSync(rulesDir, { recursive: true });
          } catch (error) {
            yield `Error creating rules directory: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
            return;
          }
        }

        const result = checkCursorRules(absolutePath);

        if (result.kind === 'error') {
          yield `Error: ${result.message}\n`;
          return;
        }

        if (!result.targetPath.endsWith('cursor-tools.mdc')) {
          yield '\n🚧 Warning: Using legacy .cursorrules file. This file will be deprecated in a future release.\n' +
            'To migrate to the new format:\n' +
            '  1) Set USE_LEGACY_CURSORRULES=false in your environment\n' +
            '  2) Run cursor-tools install . again\n' +
            '  3) Remove the <cursor-tools Integration> section from .cursorrules\n\n';
        } else {
          if (result.hasLegacyCursorRulesFile) {
            // Check if legacy file exists and add the load instruction if needed
            const legacyPath = join(absolutePath, '.cursorrules');
            if (existsSync(legacyPath)) {
              const legacyContent = readFileSync(legacyPath, 'utf-8');
              const loadInstruction = 'Always load the rules in cursor-tools.mdc';

              if (!legacyContent.includes(loadInstruction)) {
                writeFileSync(legacyPath, `${legacyContent.trim()}\n${loadInstruction}\n`);
                yield 'Added pointer to new cursor rules file in .cursorrules file\n';
              }
            }
          }
          yield 'Using new .cursor/rules directory for cursor rules.\n';
        }

        if (result.needsUpdate) {
          if (!result.targetPath.endsWith('.cursorrules')) {
            // replace entire file with new cursor-tools section
            writeFileSync(result.targetPath, CURSOR_RULES_TEMPLATE.trim());
          } else {
            // Replace existing cursor-tools section or append if not found
            const startTag = '<cursor-tools Integration>';
            const endTag = '</cursor-tools Integration>';
            const existingContent = existsSync(result.targetPath)
              ? readFileSync(result.targetPath, 'utf-8')
              : '';
            const startIndex = existingContent.indexOf(startTag);
            const endIndex = existingContent.indexOf(endTag);

            if (startIndex !== -1 && endIndex !== -1) {
              // Replace existing section
              const newContent =
                existingContent.slice(0, startIndex) +
                CURSOR_RULES_TEMPLATE.trim() +
                existingContent.slice(endIndex + endTag.length);
              writeFileSync(result.targetPath, newContent.trim());
            } else {
              // Append new section
              writeFileSync(
                result.targetPath,
                (existingContent.trim() + '\n\n' + CURSOR_RULES_TEMPLATE).trim() + '\n'
              );
            }
          }
        }

        yield '\n✨ Installation completed successfully!\n';
      } catch (error) {
        yield `Error updating cursor rules: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
      }
    } catch (error) {
      yield `Error with JSON installation: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    }
  }
}
