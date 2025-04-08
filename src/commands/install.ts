import type { Command, CommandGenerator, CommandOptions, Provider, Config } from '../types';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from '../config';
import { generateRules } from '../vibe-rules';
import { consola } from 'consola';
import { colors } from 'consola/utils';
import { JsonInstallCommand } from './jsonInstall';
import {
  VIBE_HOME_DIR,
  VIBE_HOME_ENV_PATH,
  VIBE_HOME_CONFIG_PATH,
  CLAUDE_HOME_DIR,
  LOCAL_ENV_PATH,
  LOCAL_CONFIG_PATH,
  updateRulesSection,
  ensureDirectoryExists,
  clearScreen,
  writeKeysToFile,
  checkLocalDependencies,
  getVibeToolsLogo,
  collectRequiredProviders,
  parseProviderModel,
  setupClinerules,
} from '../utils/installUtils';

interface InstallOptions extends CommandOptions {
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  global?: boolean;
}

export class InstallCommand implements Command {
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

  private async createConfig(config: {
    ide?: string;
    coding?: { provider: Provider; model: string };
    websearch?: { provider: Provider; model: string };
    tooling?: { provider: Provider; model: string };
    largecontext?: { provider: Provider; model: string };
  }): Promise<{ isLocalConfig: boolean }> {
    const finalConfig: Config = {
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
    if (config.ide) {
      finalConfig.ide = config.ide.toLowerCase();
    }

    // Map the config to the actual config structure
    if (config.coding) {
      finalConfig.repo = {
        provider: config.coding.provider,
        model: config.coding.model,
      };
    }

    if (config.tooling) {
      finalConfig.plan = {
        fileProvider: config.tooling.provider,
        thinkingProvider: config.tooling.provider,
        fileModel: config.tooling.model,
        thinkingModel: config.tooling.model,
      };
    }

    if (config.websearch) {
      finalConfig.web = {
        provider: config.websearch.provider,
        model: config.websearch.model,
      };
    }

    if (config.largecontext) {
      // This could apply to several commands that need large context
      if (!finalConfig.doc) finalConfig.doc = { provider: 'perplexity' };
      finalConfig.doc.provider = config.largecontext.provider;
      finalConfig.doc.model = config.largecontext.model;
    }

    // Ensure the VIBE_HOME_DIR exists
    ensureDirectoryExists(VIBE_HOME_DIR);

    // Ask user where to save the config
    consola.info('');
    const answer = await consola.prompt('Where would you like to save the configuration?', {
      type: 'select',
      options: [
        { value: 'global', label: `Global config (${VIBE_HOME_CONFIG_PATH})` },
        { value: 'local', label: `Local config (${LOCAL_CONFIG_PATH})` },
      ],
    });

    const isLocalConfig = answer === 'local';
    const configPath = isLocalConfig ? LOCAL_CONFIG_PATH : VIBE_HOME_CONFIG_PATH;

    try {
      writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));
      consola.success(`Configuration saved to ${colors.cyan(configPath)}`);
      return { isLocalConfig };
    } catch (error) {
      consola.error(`Error writing config to ${colors.cyan(configPath)}:`, error);
      throw error; // Rethrow to be caught by the main execute block
    }
  }

  async *execute(targetPath: string, options?: InstallOptions): CommandGenerator {
    // If JSON option is provided, use the JSON installer
    if (options?.json) {
      const jsonInstaller = new JsonInstallCommand();
      for await (const message of jsonInstaller.execute(targetPath, options)) {
        yield message;
      }
      return;
    }

    const absolutePath = join(process.cwd(), targetPath);

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

      // Check for local dependencies first
      const dependencyWarning = await checkLocalDependencies(absolutePath);
      if (dependencyWarning) {
        consola.warn(dependencyWarning);
      }

      // Ask for IDE preference
      const selectedIde = await consola.prompt('Which IDE will you be using with vibe-tools?', {
        type: 'select',
        options: [
          { value: 'cursor', label: 'Cursor', hint: 'recommended' },
          { value: 'claude-code', label: 'Claude Code' },
          { value: 'windsurf', label: 'Windsurf' },
          { value: 'cline', label: 'Cline' },
          { value: 'roo', label: 'Roo' },
        ],
        initial: 'cursor',
      });

      // Ask for model preferences
      consola.info('\nSelect your preferred models for different tasks:');

      // Coding (repo command)
      const coding = await consola.prompt('Coding Assistant (repository analysis):', {
        type: 'select',
        options: [
          { value: 'gemini:gemini-2-5-pro', label: 'Gemini Pro 2.5', hint: 'recommended' },
          { value: 'perplexity:perplexity-sonar', label: 'Perplexity Sonar' },
          { value: 'openai:gpt-4o', label: 'GPT-4o' },
          { value: 'anthropic:claude-3-opus-20240229', label: 'Claude 3 Opus' },
          {
            value: 'openrouter:openrouter/anthropic/claude-3-opus:beta',
            label: 'OpenRouter - Claude 3 Opus',
          },
        ],
        initial: 'gemini:gemini-2-5-pro',
      });

      // Web search (web command)
      const websearch = await consola.prompt('Web Search:', {
        type: 'select',
        options: [
          { value: 'perplexity:perplexity-sonar', label: 'Perplexity Sonar', hint: 'recommended' },
          { value: 'gemini:gemini-2-5-flash', label: 'Gemini Flash 2.5' },
          {
            value: 'openrouter:openrouter/perplexity/sonar-small-online',
            label: 'OpenRouter - Perplexity Sonar',
          },
        ],
        initial: 'perplexity:perplexity-sonar',
      });

      // Tooling (plan command)
      const tooling = await consola.prompt('Implementation Planning:', {
        type: 'select',
        options: [
          { value: 'gemini:gemini-2-5-pro', label: 'Gemini Pro 2.5', hint: 'recommended' },
          { value: 'openai:gpt-4o', label: 'GPT-4o' },
          { value: 'anthropic:claude-3-opus-20240229', label: 'Claude 3 Opus' },
          {
            value: 'openrouter:openrouter/anthropic/claude-3-opus:beta',
            label: 'OpenRouter - Claude 3 Opus',
          },
        ],
        initial: 'gemini:gemini-2-5-pro',
      });

      // Large context (doc command)
      const largecontext = await consola.prompt('Documentation Generation:', {
        type: 'select',
        options: [
          { value: 'perplexity:perplexity-sonar', label: 'Perplexity Sonar', hint: 'recommended' },
          { value: 'gemini:gemini-2-5-pro', label: 'Gemini Pro 2.5' },
          { value: 'openai:gpt-4o', label: 'GPT-4o' },
          { value: 'anthropic:claude-3-opus-20240229', label: 'Claude 3 Opus' },
        ],
        initial: 'perplexity:perplexity-sonar',
      });

      // Collect all selected options into a config object
      const config = {
        ide: selectedIde,
        coding: parseProviderModel(coding as string),
        websearch: parseProviderModel(websearch as string),
        tooling: parseProviderModel(tooling as string),
        largecontext: parseProviderModel(largecontext as string),
      };

      // Create a more compact and readable display of the configuration
      const formatProviderInfo = (provider: string, model: string) => {
        // Trim the provider prefix from the model name if it exists
        const modelDisplay = model.includes('/') ? model.split('/').pop() : model;
        return `${colors.cyan(provider.charAt(0).toUpperCase() + provider.slice(1))} ${colors.gray('→')} ${colors.green(modelDisplay || model)}`;
      };

      const configDisplay = Object.entries(config)
        .map(([key, value]) => {
          if (key === 'ide') return `IDE: ${colors.magenta(String(value))}`;
          const configVal = value as { provider: string; model: string };
          // Format key as "Coding:" instead of "coding:"
          const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
          return `${colors.yellow(formattedKey)}: ${formatProviderInfo(configVal.provider, configVal.model)}`;
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
      const requiredProviders = collectRequiredProviders(config);

      // Setup API keys
      for await (const message of this.setupApiKeys(requiredProviders)) {
        yield message;
      }

      // Create config file and get its location preference
      const { isLocalConfig } = await this.createConfig(config);

      // Handle IDE-specific rules setup
      // For cursor, create the new directory structure
      if (selectedIde === 'cursor') {
        // Create necessary directories
        const rulesDir = join(absolutePath, '.cursor', 'rules');
        ensureDirectoryExists(rulesDir);

        // Write the rules file directly to the new location
        const rulesPath = join(rulesDir, 'vibe-tools.mdc');
        try {
          writeFileSync(rulesPath, generateRules('cursor', true));
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
            rulesTemplate = generateRules('cursor', true);
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
          `• ${colors.cyan('Check if you have appropriate permissions')}`,
          `• ${colors.cyan('Ensure your environment is correctly set up')}`,
          '',
          `For help: ${colors.green('vibe-tools --help')}`,
        ].join('\n'),
      });
    }
  }
}
