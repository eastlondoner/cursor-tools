import type { Command, CommandGenerator, CommandOptions, Provider, Config } from '../types';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadEnv } from '../config';
import { CURSOR_RULES_TEMPLATE } from '../cursorrules';
import { CLINE_ROO_RULES_TEMPLATE } from '../clineroorules';

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

// Valid providers that vibe-tools supports
// Note: The case here is important as it's used to normalize user input to the expected format
const VALID_PROVIDERS = ['Openrouter', 'Perplexity', 'Openai', 'Anthropic', 'Modelbox', 'Gemini'];
const VALID_PROVIDERS_LOWERCASE = VALID_PROVIDERS.map((p) => p.toLowerCase());

// Define directory paths
const LEGACY_HOME_DIR = join(homedir(), '.cursor-tools');
const VIBE_HOME_DIR = join(homedir(), '.vibe-tools');
const VIBE_HOME_ENV_PATH = join(VIBE_HOME_DIR, '.env');
const VIBE_HOME_CONFIG_PATH = join(VIBE_HOME_DIR, 'config.json');
const CLAUDE_HOME_DIR = join(homedir(), '.claude'); // Global Claude directory
const LOCAL_ENV_PATH = join(process.cwd(), '.vibe-tools.env'); // Keep local path definition separate
const LOCAL_CONFIG_PATH = join(process.cwd(), 'vibe-tools.config.json'); // Keep local path definition separate

// Helper to parse JSON configuration
function parseJsonConfig(
  jsonString: string
): Record<string, { provider: Provider; model: string }> & { ide?: string } {
  try {
    const parsedConfig = JSON.parse(jsonString);
    const validIdes = ['cursor', 'claude-code', 'windsurf', 'cline', 'roo'];

    // Validate that each provider is valid
    for (const [key, value] of Object.entries(parsedConfig)) {
      if (key === 'ide') {
        // Validate IDE if provided
        if (typeof value !== 'string') {
          throw new Error(`IDE must be a string, got: ${typeof value}`);
        }

        if (!validIdes.includes(value.toLowerCase())) {
          throw new Error(`Invalid IDE "${value}". Valid IDE options are: ${validIdes.join(', ')}`);
        }

        // Skip further validation for ide
        continue;
      }

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

    return parsedConfig as Record<string, { provider: Provider; model: string }> & { ide?: string };
  } catch (error) {
    throw new Error(
      `Invalid JSON configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Collect unique providers from JSON configuration
function collectRequiredProviders(
  config: Record<string, { provider: Provider; model: string }> & { ide?: string }
): Provider[] {
  const providers = new Set<Provider>();

  Object.entries(config).forEach(([key, value]) => {
    // Skip the ide key and ensure value has provider property
    if (key === 'ide' || typeof value !== 'object' || !('provider' in value)) return;

    // Provider should already be normalized to correct case from parseJsonConfig
    providers.add(value.provider);
  });

  return Array.from(providers);
}

// Helper function to update or add vibe-tools section in IDE rules files like windsurfrules, claude.md etc
function updateRulesSection(filePath: string, rulesTemplate: string): void {
  // Check if file exists and read its content
  let existingContent = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';

  // Replace existing vibe-tools section or append if not found
  const startTag = '<vibe-tools Integration>';
  const endTag = '</vibe-tools Integration>';
  const startIndex = existingContent.indexOf(startTag);
  const endIndex = existingContent.indexOf(endTag);

  if (startIndex !== -1 && endIndex !== -1) {
    // Replace existing section
    const newContent =
      existingContent.slice(0, startIndex) +
      rulesTemplate.trim() +
      existingContent.slice(endIndex + endTag.length);
    writeFileSync(filePath, newContent.trim());
  } else {
    // Append new section
    writeFileSync(filePath, (existingContent.trim() + '\n\n' + rulesTemplate).trim() + '\n');
  }
}

export class JsonInstallCommand implements Command {
  private async *setupApiKeys(requiredProviders: Provider[]): CommandGenerator {
    loadEnv(); // Load existing env files if any

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
        yield '\nWarning: No API keys provided. You will need to set up keys manually to use vibe-tools with your configuration.\n';
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
        writeKeysToFile(VIBE_HOME_ENV_PATH, keys);
        yield `\nAPI keys written to ${VIBE_HOME_ENV_PATH}\n`;
      } catch (error) {
        console.error('Error writing API keys to home directory:', error);
        writeKeysToFile(LOCAL_ENV_PATH, keys);
        yield `\nAPI keys written to ${LOCAL_ENV_PATH} in the current directory\n`;
      }
    } catch (error) {
      console.error('Error setting up API keys:', error);
      yield 'Error setting up API keys. You can add them later manually.\n';
    }
  }

  private async createConfig(
    jsonConfig: Record<string, { provider: Provider; model: string }> & { ide?: string }
  ): Promise<{ isLocalConfig: boolean }> {
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

    // Add ide if present
    if (jsonConfig.ide) {
      config.ide = jsonConfig.ide.toLowerCase();
    }

    // Map the JSON config to the actual config structure
    for (const [key, value] of Object.entries(jsonConfig)) {
      // Skip 'ide' key as we've already handled it
      if (key === 'ide') continue;

      const configValue = value as { provider: Provider; model: string };

      switch (key) {
        case 'coding':
          config.repo = {
            provider: configValue.provider,
            model: configValue.model,
          };
          break;
        case 'tooling':
          config.plan = {
            fileProvider: configValue.provider,
            thinkingProvider: configValue.provider,
            fileModel: configValue.model,
            thinkingModel: configValue.model,
          };
          break;
        case 'websearch':
          config.web = {
            provider: configValue.provider,
            model: configValue.model,
          };
          break;
        case 'largecontext':
          // This could apply to several commands that need large context
          if (!config.doc) config.doc = { provider: 'perplexity' };
          config.doc.provider = configValue.provider;
          config.doc.model = configValue.model;
          break;
      }
    }

    // Ensure the VIBE_HOME_DIR exists (might have been created during migration or needs creation now)
    if (!existsSync(VIBE_HOME_DIR)) {
      mkdirSync(VIBE_HOME_DIR, { recursive: true });
    }

    // Ask user where to save the config
    console.log('\nWhere would you like to save the configuration?');
    console.log(`1) Global config (${VIBE_HOME_CONFIG_PATH})`);
    console.log(`2) Local config (${LOCAL_CONFIG_PATH})`);

    const answer = await getUserInput('Enter choice (1 or 2): ');
    const isLocalConfig = answer === '2';
    const configPath = isLocalConfig ? LOCAL_CONFIG_PATH : VIBE_HOME_CONFIG_PATH;

    try {
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`\nConfig saved to ${configPath}`);
      return { isLocalConfig };
    } catch (error) {
      console.error(`Error writing config to ${configPath}:`, error);
      throw error; // Rethrow to be caught by the main execute block
    }
  }

  // New method to handle migration from .cursor-tools
  private async *handleMigration(): CommandGenerator {
    yield 'Checking for legacy ~/.cursor-tools directory...\n';

    if (existsSync(LEGACY_HOME_DIR)) {
      yield `Found legacy configuration directory: ${LEGACY_HOME_DIR}\n`;

      if (existsSync(VIBE_HOME_DIR)) {
        yield `Existing new configuration directory found: ${VIBE_HOME_DIR}\n`;
        const answer = await getUserInput(
          `Do you want to replace ${VIBE_HOME_DIR} with the contents of ${LEGACY_HOME_DIR}? (y/N): `
        );

        if (answer.toLowerCase() === 'y') {
          try {
            yield `Removing existing ${VIBE_HOME_DIR}...\n`;
            rmSync(VIBE_HOME_DIR, { recursive: true, force: true });
            yield `Migrating ${LEGACY_HOME_DIR} to ${VIBE_HOME_DIR}...\n`;
            renameSync(LEGACY_HOME_DIR, VIBE_HOME_DIR);
            yield `✅ Migration successful. Using configuration from migrated ${VIBE_HOME_DIR}.\n`;
          } catch (error) {
            yield `❌ Error during migration: ${error instanceof Error ? error.message : 'Unknown error'}\nPlease resolve manually.\n`;
            // Ensure VIBE_HOME_DIR exists even if migration failed mid-way
            if (!existsSync(VIBE_HOME_DIR)) {
              mkdirSync(VIBE_HOME_DIR, { recursive: true });
            }
          }
        } else {
          yield `Skipping migration. Using existing ${VIBE_HOME_DIR}.\n`;
        }
      } else {
        // New directory doesn't exist, just rename the legacy one
        try {
          yield `Migrating ${LEGACY_HOME_DIR} to ${VIBE_HOME_DIR}...\n`;
          renameSync(LEGACY_HOME_DIR, VIBE_HOME_DIR);
          yield `✅ Migration successful. Using configuration from migrated ${VIBE_HOME_DIR}.\n`;
        } catch (error) {
          yield `❌ Error migrating ${LEGACY_HOME_DIR}: ${error instanceof Error ? error.message : 'Unknown error'}\nPlease create ${VIBE_HOME_DIR} manually.\n`;
          // Ensure VIBE_HOME_DIR exists even if migration failed
          if (!existsSync(VIBE_HOME_DIR)) {
            mkdirSync(VIBE_HOME_DIR, { recursive: true });
          }
        }
      }
    } else {
      yield 'No legacy ~/.cursor-tools directory found.\n';
      // Ensure the new directory exists if the legacy one wasn't found
      if (!existsSync(VIBE_HOME_DIR)) {
        try {
          mkdirSync(VIBE_HOME_DIR, { recursive: true });
          yield `Created configuration directory: ${VIBE_HOME_DIR}\n`;
        } catch (error) {
          yield `❌ Error creating ${VIBE_HOME_DIR}: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
        }
      }
    }
    // Add a newline for better formatting after migration messages
    yield '\n';
  }

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    const targetPath = query || '.';
    const absolutePath = join(process.cwd(), targetPath);

    if (typeof options.json !== 'string') {
      throw new Error('JSON configuration is required for this command');
    }

    try {
      // Handle migration first
      yield* this.handleMigration();

      // Parse JSON configuration
      const jsonConfig = parseJsonConfig(options.json);

      // Identify required providers
      const requiredProviders = collectRequiredProviders(jsonConfig);

      // Setup API keys
      yield 'Setting up API keys for required providers...\n';
      for await (const message of this.setupApiKeys(requiredProviders)) {
        yield message;
      }

      // Create config file and get its location preference
      yield '\nCreating configuration file...\n';
      const { isLocalConfig } = await this.createConfig(jsonConfig);

      // Handle IDE-specific rules setup
      const selectedIde = jsonConfig.ide?.toLowerCase() || 'cursor';
      yield `\nSetting up rules for ${selectedIde}...\n`;

      if (selectedIde === 'cursor') {
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

        // Write the rules file directly to the new location
        const rulesPath = join(rulesDir, 'vibe-tools.mdc');
        try {
          writeFileSync(rulesPath, CURSOR_RULES_TEMPLATE.trim());
          yield `✅ Rules written to ${rulesPath}\n`;
        } catch (error) {
          yield `Error writing rules for cursor: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
          return;
        }

        yield 'Using new .cursor/rules directory for cursor rules.\n';
      } else {
        // For other IDEs, add the rules template to the respective file
        let rulesPath: string;
        let rulesTemplate: string;

        switch (selectedIde) {
          case 'claude-code':
            // For Claude Code, use local/global path based on config location choice
            if (isLocalConfig) {
              rulesPath = join(absolutePath, 'CLAUDE.md'); // Use target path for local
            } else {
              // Use global Claude directory
              if (!existsSync(CLAUDE_HOME_DIR)) {
                mkdirSync(CLAUDE_HOME_DIR, { recursive: true });
              }
              rulesPath = join(CLAUDE_HOME_DIR, 'CLAUDE.md');
            }
            rulesTemplate = CURSOR_RULES_TEMPLATE;
            break;
          case 'windsurf':
            rulesPath = join(absolutePath, '.windsurfrules');
            rulesTemplate = CURSOR_RULES_TEMPLATE;
            break;
          case 'cline':
          case 'roo':
            rulesPath = join(absolutePath, '.clinerules');
            rulesTemplate = CLINE_ROO_RULES_TEMPLATE;
            break;
          default:
            rulesPath = join(absolutePath, '.cursor', 'rules', 'vibe-tools.mdc');
            rulesTemplate = CURSOR_RULES_TEMPLATE;
            break;
        }

        try {
          // Ensure the directory exists if needed
          const dir = join(rulesPath, '..');
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }

          // For Cline and Roo, we don't use start/end tags as they have a different format
          if (selectedIde === 'cline' || selectedIde === 'roo') {
            // Just write the template, don't try to find sections to replace
            writeFileSync(rulesPath, rulesTemplate);
          } else {
            // Use the utility function to update the rules section
            updateRulesSection(rulesPath, rulesTemplate);
          }

          yield `✅ Rules written to ${rulesPath}\n`;
        } catch (error) {
          yield `Error writing rules for ${selectedIde}: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
        }
      }

      yield '\n✨ Installation completed successfully!\n';
    } catch (error) {
      yield `Error with JSON installation: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    }
  }
}
