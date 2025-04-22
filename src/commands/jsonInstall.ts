import type { Command, CommandGenerator, CommandOptions, Provider, Config } from '../types';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from '../config';
import { generateRules } from '../vibe-rules';
import { consola } from 'consola';
import { colors } from 'consola/utils';
import {
  VIBE_HOME_DIR,
  VIBE_HOME_ENV_PATH,
  VIBE_HOME_CONFIG_PATH,
  CLAUDE_HOME_DIR,
  CODEX_GLOBAL_INSTRUCTIONS_PATH,
  CODEX_LOCAL_INSTRUCTIONS_FILENAME,
  LOCAL_ENV_PATH,
  LOCAL_CONFIG_PATH,
  VALID_PROVIDERS,
  VALID_PROVIDERS_LOWERCASE,
  updateRulesSection,
  ensureDirectoryExists,
  clearScreen,
  writeKeysToFile,
  getVibeToolsLogo,
  collectRequiredProviders,
  setupClinerules,
  handleLegacyMigration,
} from '../utils/installUtils';

// Helper to parse JSON configuration
function parseJsonConfig(
  jsonString: string
): Record<string, { provider: Provider; model: string }> & { ide?: string } {
  try {
    const parsedConfig = JSON.parse(jsonString);
    const validIdes = ['cursor', 'claude-code', 'codex', 'windsurf', 'cline', 'roo'];
    let configToUse = parsedConfig;

    // Check if there's an "agents" wrapper and use it if present
    if (parsedConfig.agents && typeof parsedConfig.agents === 'object') {
      // Merge agents into top level, preserving ide if it exists
      configToUse = {
        ...parsedConfig.agents,
        ...(parsedConfig.ide ? { ide: parsedConfig.ide } : {}),
      };
    }

    // Validate that each provider is valid
    for (const [key, value] of Object.entries(configToUse)) {
      if (key === 'ide') {
        // Validate IDE if provided
        if (typeof value !== 'string') {
          throw new Error(`IDE must be a string, got: ${typeof value}`);
        }

        const lowerIde = value.toLowerCase(); // Normalize to lowercase
        if (!validIdes.includes(lowerIde)) {
          throw new Error(`Invalid IDE "${value}". Valid IDE options are: ${validIdes.join(', ')}`);
        }

        // Store the normalized lowercase IDE name
        configToUse[key] = lowerIde;

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
      // Ensure provider is stored in lowercase
      providerObj.provider = VALID_PROVIDERS_LOWERCASE[providerIndex] as Provider;
    }

    return configToUse as Record<string, { provider: Provider; model: string }> & { ide?: string };
  } catch (error) {
    throw new Error(
      `Invalid JSON configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export class JsonInstallCommand implements Command {
  private async *setupApiKeys(requiredProviders: Provider[]): CommandGenerator {
    try {
      loadEnv(); // Load existing env files if any

      // Record to store keys
      const keys: Record<string, string> = {};

      // Now ask for each required provider
      for (const provider of requiredProviders) {
        const envKey = `${provider.toUpperCase()}_API_KEY`;
        const currentValue = process.env[envKey];

        if (currentValue) {
          consola.success(`Using existing ${colors.cyan(provider)} API key from environment.`);
          keys[envKey] = currentValue;
        } else {
          // Skip if SKIP_SETUP is set
          if (process.env.SKIP_SETUP) {
            consola.warn(
              `No ${colors.cyan(provider)} API key found in environment. You may need to set it manually.`
            );
            continue;
          }

          // Ask for API key with interactive prompt
          const key = await consola.prompt(`${colors.cyan(provider)} API Key:`, {
            type: 'text',
            placeholder: 'sk-...',
            validate: (value: string) => value.length > 0 || 'Press Enter to skip',
          });

          if (key && typeof key === 'string') {
            keys[envKey] = key;
            consola.success(`${colors.cyan(provider)} API key set`);
          } else {
            consola.warn(`Skipped ${colors.cyan(provider)} API key`);
          }
        }
      }

      // Check if user provided at least one key
      const hasAtLeastOneKey = Object.values(keys).some((value) => !!value);

      if (!hasAtLeastOneKey) {
        consola.warn(`No API keys were provided. You'll need to set them up manually later.`);
        return;
      }

      // Try to write to home directory first, fall back to local if it fails
      try {
        writeKeysToFile(VIBE_HOME_ENV_PATH, keys);
        consola.success(`API keys saved to ${colors.cyan(VIBE_HOME_ENV_PATH)}`);
      } catch (error) {
        consola.error(`${colors.red('Failed to write to home directory:')}`, error);
        writeKeysToFile(LOCAL_ENV_PATH, keys);
        consola.success(
          `API keys saved to ${colors.cyan(LOCAL_ENV_PATH)} in the current directory`
        );
      }
    } catch (error) {
      consola.error(`${colors.red('Error setting up API keys:')}`, error);
      yield 'Error setting up API keys. You can add them later manually.\n';
    }
  }

  private async checkExistingGlobalConfig(): Promise<Config | null> {
    const globalConfigPath = VIBE_HOME_CONFIG_PATH;
    if (existsSync(globalConfigPath)) {
      try {
        const configContent = readFileSync(globalConfigPath, 'utf-8');
        return JSON.parse(configContent) as Config;
      } catch (error) {
        consola.error(`Error reading global config: ${error}`);
      }
    }
    return null;
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
      config.ide = jsonConfig.ide.toLowerCase(); // Ensure IDE name is lowercase
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

    // Ensure the VIBE_HOME_DIR exists
    ensureDirectoryExists(VIBE_HOME_DIR);

    // Prepare message about IDE rules location
    let rulesLocationMessage = '';
    if (jsonConfig.ide === 'codex' || jsonConfig.ide === 'claude-code') {
      rulesLocationMessage =
        jsonConfig.ide === 'codex'
          ? `\nNote: For Codex, choosing 'Global' will save rules to ${CODEX_GLOBAL_INSTRUCTIONS_PATH}, and 'Local' will save to ./${CODEX_LOCAL_INSTRUCTIONS_FILENAME}`
          : `\nNote: For Claude Code, choosing 'Global' will save rules to ${CLAUDE_HOME_DIR}/CLAUDE.md, and 'Local' will save to ./CLAUDE.md`;
    }

    // Ask user where to save the config
    consola.info('');
    const answer = await consola.prompt(
      `Where would you like to save the configuration?${rulesLocationMessage}`,
      {
        type: 'select',
        options: [
          { value: 'global', label: `Global config (${VIBE_HOME_CONFIG_PATH})` },
          { value: 'local', label: `Local config (${LOCAL_CONFIG_PATH})` },
        ],
      }
    );

    const isLocalConfig = answer === 'local';
    const configPath = isLocalConfig ? LOCAL_CONFIG_PATH : VIBE_HOME_CONFIG_PATH;

    // Ensure all provider names are lowercase before writing
    if (config.repo?.provider) {
      config.repo.provider = config.repo.provider.toLowerCase() as Provider;
    }
    if (config.plan?.fileProvider) {
      config.plan.fileProvider = config.plan.fileProvider.toLowerCase() as Provider;
    }
    if (config.plan?.thinkingProvider) {
      config.plan.thinkingProvider = config.plan.thinkingProvider.toLowerCase() as Provider;
    }
    if (config.web?.provider) {
      config.web.provider = config.web.provider.toLowerCase() as Provider;
    }
    if (config.doc?.provider) {
      config.doc.provider = config.doc.provider.toLowerCase() as Provider;
    }

    try {
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      consola.success(`Configuration saved to ${colors.cyan(configPath)}`);
      return { isLocalConfig };
    } catch (error) {
      consola.error(`Error writing config to ${colors.cyan(configPath)}:`, error);
      throw error; // Rethrow to be caught by the main execute block
    }
  }

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    const targetPath = query || '.';
    const absolutePath = join(process.cwd(), targetPath);

    if (typeof options.json !== 'string') {
      throw new Error('JSON configuration is required for this command');
    }

    try {
      // Clear the screen for a clean start
      clearScreen();

      // Welcome message
      const logo = getVibeToolsLogo();

      consola.box({
        title: '🚀 Welcome to Vibe-Tools Setup!',
        titleColor: 'white',
        borderColor: 'green',
        style: {
          padding: 2,
          borderStyle: 'rounded',
        },
        message: logo,
      });

      // Load env AFTER displaying welcome message
      loadEnv();

      // Handle migration first using the shared utility function
      yield* handleLegacyMigration();

      // Parse JSON configuration
      const jsonConfig = parseJsonConfig(options.json);

      // Check if the Gemini 2.5 Pro model name needs to be updated (for backward compatibility)
      for (const [key, value] of Object.entries(jsonConfig)) {
        if (
          key !== 'ide' &&
          value &&
          typeof value === 'object' &&
          'provider' in value &&
          'model' in value
        ) {
          const configVal = value as { provider: string; model: string };
          // If provider is gemini and model is the old name, update it
          if (
            configVal.provider.toLowerCase() === 'gemini' &&
            configVal.model === 'gemini-2.5-pro-exp-03-25'
          ) {
            configVal.model = 'gemini-2.5-pro-preview-03-25';
          }
        }
      }

      // Create a more compact and readable display of the configuration
      const formatProviderInfo = (provider: string, model: string) => {
        // Trim the provider prefix from the model name if it exists
        const modelDisplay = model.includes('/') ? model.split('/').pop() : model;
        return `${colors.cyan(provider.charAt(0).toUpperCase() + provider.slice(1))} ${colors.gray('→')} ${colors.green(modelDisplay || model)}`;
      };

      const configDisplay = Object.entries(jsonConfig)
        .map(([key, value]) => {
          if (key === 'ide') return `IDE: ${colors.magenta(String(value))}`;
          const config = value as { provider: string; model: string };
          // Format key as "Coding:" instead of "coding:"
          const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
          return `${colors.yellow(formattedKey)}: ${formatProviderInfo(config.provider, config.model)}`;
        })
        .join('\n  • ');

      consola.box({
        title: '📋 Your Configuration',
        titleColor: 'white',
        borderColor: 'green',
        style: {
          padding: 2,
          borderStyle: 'rounded',
        },
        message: `  • ${configDisplay}`,
      });

      // Identify required providers
      const requiredProviders = collectRequiredProviders(jsonConfig);

      // Setup API keys
      for await (const message of this.setupApiKeys(requiredProviders)) {
        yield message;
      }

      // Create config file and get its location preference
      const { isLocalConfig } = await this.createConfig(jsonConfig);

      // Handle IDE-specific rules setup
      const selectedIde = jsonConfig.ide?.toLowerCase() || 'cursor';

      // Re-add the IDE setup code but with simplified output
      if (selectedIde === 'cursor') {
        // Create necessary directories
        const rulesDir = join(absolutePath, '.cursor', 'rules');
        ensureDirectoryExists(rulesDir);

        // Write the rules file directly to the new location
        const rulesPath = join(rulesDir, 'vibe-tools.mdc');
        try {
          writeFileSync(rulesPath, generateRules('cursor'));
          consola.success(`Rules written to ${colors.cyan(rulesPath)}`);
        } catch (error) {
          consola.error(`${colors.red('Error writing rules for cursor:')}`, error);
          return;
        }
      } else {
        // For other IDEs, add the rules template to the respective file
        let rulesPath: string;
        let rulesTemplate: string;

        switch (selectedIde) {
          case 'claude-code': {
            rulesTemplate = generateRules('claude-code');

            // Handle both global and local Claude.md files
            if (isLocalConfig) {
              // Local Claude.md
              rulesPath = join(absolutePath, 'CLAUDE.md');
              ensureDirectoryExists(join(rulesPath, '..'));
              updateRulesSection(rulesPath, rulesTemplate);
              consola.success(`Updated local Claude.md rules at ${rulesPath}`);
            } else {
              // Global Claude.md
              ensureDirectoryExists(CLAUDE_HOME_DIR);
              rulesPath = join(CLAUDE_HOME_DIR, 'CLAUDE.md');
              updateRulesSection(rulesPath, rulesTemplate);
              consola.success(`Updated global Claude.md rules at ${rulesPath}`);
            }
            break;
          }
          case 'codex': {
            rulesTemplate = generateRules('codex');

            // Handle both global and local codex.md files
            if (isLocalConfig) {
              // Local codex.md
              rulesPath = join(absolutePath, CODEX_LOCAL_INSTRUCTIONS_FILENAME);
              ensureDirectoryExists(join(rulesPath, '..'));
              updateRulesSection(rulesPath, rulesTemplate);
              consola.success(
                `Updated local ${CODEX_LOCAL_INSTRUCTIONS_FILENAME} rules at ${rulesPath}`
              );
            } else {
              // Global ~/.codex/instructions.md
              ensureDirectoryExists(join(CODEX_GLOBAL_INSTRUCTIONS_PATH, '..'));
              rulesPath = CODEX_GLOBAL_INSTRUCTIONS_PATH;
              updateRulesSection(rulesPath, rulesTemplate);
              consola.success(`Updated global ${CODEX_GLOBAL_INSTRUCTIONS_PATH} rules`);
            }
            break;
          }
          case 'windsurf': {
            rulesPath = join(absolutePath, '.windsurfrules');
            rulesTemplate = generateRules('windsurf');
            ensureDirectoryExists(join(rulesPath, '..'));
            updateRulesSection(rulesPath, rulesTemplate);
            consola.success(`Updated .windsurfrules at ${rulesPath}`);
            break;
          }
          case 'cline': {
            await setupClinerules(absolutePath, 'cline', generateRules);
            break;
          }
          case 'roo': {
            // Roo uses the same .clinerules directory/file as cline
            await setupClinerules(absolutePath, 'roo', generateRules);
            break;
          }
          default: {
            rulesPath = join(absolutePath, '.cursor', 'rules', 'vibe-tools.mdc');
            rulesTemplate = generateRules('cursor');
            ensureDirectoryExists(join(rulesPath, '..'));
            writeFileSync(rulesPath, rulesTemplate.trim());
            consola.success(`Rules written to ${rulesPath}`);
            break;
          }
        }
      }

      // Installation completed
      consola.box({
        title: '🎉 Installation Complete!',
        titleColor: 'white',
        borderColor: 'green',
        style: {
          padding: 2,
          borderStyle: 'rounded',
        },
        message: [
          `${colors.green('Vibe-Tools has been successfully configured!')}`,
          '',
          `📋 Configuration: ${colors.cyan(isLocalConfig ? 'Local' : 'Global')}`,
          `🔧 IDE: ${colors.cyan(selectedIde)}`,
          '',
          `${colors.yellow('Get started with:')}`,
          `  ${colors.green('vibe-tools repo')} ${colors.white('"Explain this codebase"')}`,
          `  ${colors.green('vibe-tools web')} ${colors.white('"Search for something online"')}`,
          `  ${colors.green('vibe-tools plan')} ${colors.white('"Create implementation plan"')}`,
        ].join('\n'),
      });
    } catch (error) {
      consola.box({
        title: '❌ Installation Failed',
        titleColor: 'white',
        borderColor: 'red',
        style: {
          padding: 2,
          borderStyle: 'rounded',
        },
        message: [
          `Error: ${colors.red(error instanceof Error ? error.message : 'Unknown error')}`,
          '',
          `${colors.yellow('Possible solutions:')}`,
          `• ${colors.cyan('Check your JSON configuration format')}`,
          `• ${colors.cyan('Ensure you have appropriate permissions')}`,
          '',
          `If you need assistance, reach out to the vibe-tools team or try re-running the installation.`,
        ].join('\n'),
      });
    }
  }
}
