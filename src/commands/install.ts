import type { Command, CommandGenerator, CommandOptions, Provider, Config } from '../types';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
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
  CODEX_GLOBAL_INSTRUCTIONS_PATH,
  CODEX_LOCAL_INSTRUCTIONS_FILENAME,
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
  handleLegacyMigration,
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

    // Map the config from the selections (or potentially pre-filled from existing global)
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

    // Prepare message about IDE rules location
    let rulesLocationMessage = '';
    if (config.ide === 'codex' || config.ide === 'claude-code') {
      rulesLocationMessage =
        config.ide === 'codex'
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
    if (finalConfig.repo?.provider) {
      finalConfig.repo.provider = finalConfig.repo.provider.toLowerCase() as Provider;
    }
    if (finalConfig.plan?.fileProvider) {
      finalConfig.plan.fileProvider = finalConfig.plan.fileProvider.toLowerCase() as Provider;
    }
    if (finalConfig.plan?.thinkingProvider) {
      finalConfig.plan.thinkingProvider =
        finalConfig.plan.thinkingProvider.toLowerCase() as Provider;
    }
    if (finalConfig.web?.provider) {
      finalConfig.web.provider = finalConfig.web.provider.toLowerCase() as Provider;
    }
    if (finalConfig.doc?.provider) {
      finalConfig.doc.provider = finalConfig.doc.provider.toLowerCase() as Provider;
    }

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

      // Handle legacy migration *before* asking for new setup
      yield* handleLegacyMigration();

      // Check for existing global config before asking for preferences
      const existingGlobalConfig = await this.checkExistingGlobalConfig();
      let useExistingGlobal = false;

      if (existingGlobalConfig) {
        useExistingGlobal = await consola.prompt(
          'Found existing global configuration. Would you like to use it?',
          { type: 'confirm' }
        );
      }

      // Ask for IDE preference
      const selectedIde = await consola.prompt('Which IDE will you be using with vibe-tools?', {
        type: 'select',
        options: [
          { value: 'cursor', label: 'Cursor', hint: 'recommended' },
          { value: 'claude-code', label: 'Claude Code' },
          { value: 'codex', label: 'Codex' },
          { value: 'windsurf', label: 'Windsurf' },
          { value: 'cline', label: 'Cline' },
          { value: 'roo', label: 'Roo' },
        ],
        initial:
          useExistingGlobal && existingGlobalConfig?.ide ? existingGlobalConfig.ide : 'cursor',
      });

      // Create initial config with defaults
      let config: {
        ide?: string;
        coding?: { provider: Provider; model: string };
        websearch?: { provider: Provider; model: string };
        tooling?: { provider: Provider; model: string };
        largecontext?: { provider: Provider; model: string };
      } = {
        ide: selectedIde,
      };

      // If using existing global config, use those values as defaults
      if (useExistingGlobal && existingGlobalConfig) {
        config = {
          ide: selectedIde,
          coding: existingGlobalConfig.repo
            ? {
                provider: existingGlobalConfig.repo.provider as Provider,
                model: existingGlobalConfig.repo.model || '',
              }
            : undefined,
          websearch:
            existingGlobalConfig.web && existingGlobalConfig.web.provider
              ? {
                  provider: existingGlobalConfig.web.provider as Provider,
                  model: existingGlobalConfig.web.model || '',
                }
              : undefined,
          tooling:
            existingGlobalConfig.plan && existingGlobalConfig.plan.thinkingProvider
              ? {
                  provider: existingGlobalConfig.plan.thinkingProvider as Provider,
                  model: existingGlobalConfig.plan.thinkingModel || '',
                }
              : undefined,
          largecontext:
            existingGlobalConfig.doc && existingGlobalConfig.doc.provider
              ? {
                  provider: existingGlobalConfig.doc.provider as Provider,
                  model: existingGlobalConfig.doc.model || '',
                }
              : undefined,
        };

        consola.success('Using existing configuration values as defaults');
      } else {
        // Ask for model preferences only if not using existing config
        consola.info('\nSelect your preferred models for different tasks:');

        // Coding (repo command)
        const coding = await consola.prompt('Coding Agent - Code Crafter & Bug Blaster:', {
          type: 'select',
          options: [
            {
              value: 'gemini:gemini-2.5-flash-preview-04-17',
              label: 'Gemini Flash 2.5',
              hint: 'recommended',
            },
            {
              value: 'anthropic:claude-3-7-sonnet-20250219',
              label: 'Claude 3.7 Sonnet',
              hint: 'recommended',
            },
            { value: 'perplexity:sonar-pro', label: 'Perplexity Sonar Pro' },
            { value: 'openai:gpt-4.1-2025-04-14', label: 'GPT-4.1' },
            {
              value: 'openrouter:anthropic/claude-3.7-sonnet',
              label: 'OpenRouter - Claude 3.7 Sonnet',
            },
            {
              value: 'openrouter:x-ai/grok-3-beta',
              label: 'OpenRouter - Grok 3',
            },
            {
              value: 'openrouter:x-ai/grok-3-mini-beta',
              label: 'OpenRouter - Grok 3 Mini',
            },
          ],
          initial: 'gemini:gemini-2.5-flash-preview-04-17',
        });

        // Web search (web command)
        const websearch = await consola.prompt(
          'Web Search Agent - Deep Researcher & Web Wanderer:',
          {
            type: 'select',
            options: [
              { value: 'perplexity:sonar-pro', label: 'Perplexity Sonar Pro', hint: 'recommended' },
              { value: 'perplexity:sonar', label: 'Perplexity Sonar', hint: 'recommended' },
              { value: 'gemini:gemini-2.0-flash', label: 'Gemini Flash 2.0' },
              {
                value: 'openrouter:perplexity/sonar-pro',
                label: 'OpenRouter - Perplexity Sonar Pro',
              },
            ],
            initial: 'perplexity:sonar-pro',
          }
        );

        // Tooling (plan command)
        const tooling = await consola.prompt('Tooling Agent - Gear Turner & MCP Master:', {
          type: 'select',
          options: [
            {
              value: 'anthropic:claude-3-7-sonnet',
              label: 'Claude 3.7 Sonnet',
              hint: 'recommended',
            },
            {
              value: 'gemini:gemini-2.5-pro-preview-03-25',
              label: 'Gemini Pro 2.5',
              hint: 'recommended',
            },
            { value: 'openai:gpt-4o', label: 'GPT-4o' },
            {
              value: 'openrouter:anthropic/claude-3.7-sonnet',
              label: 'OpenRouter - Claude 3.7 Sonnet',
            },
            {
              value: 'openrouter:x-ai/grok-3-beta',
              label: 'OpenRouter - Grok 3',
            },
            {
              value: 'openrouter:x-ai/grok-3-mini-beta',
              label: 'OpenRouter - Grok 3 Mini',
            },
          ],
          initial: 'anthropic:claude-3-7-sonnet',
        });

        // Large context (doc command)
        const largecontext = await consola.prompt(
          'Large Context Agent - Systems Thinker & Expert Planner:',
          {
            type: 'select',
            options: [
              {
                value: 'gemini:gemini-2.5-pro-preview-03-25',
                label: 'Gemini Pro 2.5',
                hint: 'recommended',
              },
              {
                value: 'anthropic:claude-3-7-sonnet',
                label: 'Claude 3.7 Sonnet',
                hint: 'recommended',
              },
              {
                value: 'gemini:gemini-1.5-pro',
                label: 'Gemini 2.0 Pro',
                hint: 'recommended',
              },
              { value: 'perplexity:sonar', label: 'Perplexity Sonar' },
              { value: 'openai:gpt-4o', label: 'GPT-4o' },
              {
                value: 'openrouter:x-ai/grok-3-beta',
                label: 'OpenRouter - Grok 3',
              },
            ],
            initial: 'gemini:gemini-2.5-pro-preview-03-25',
          }
        );

        // Collect all selected options into a config object
        config = {
          ide: selectedIde,
          coding: parseProviderModel(coding as string),
          websearch: parseProviderModel(websearch as string),
          tooling: parseProviderModel(tooling as string),
          largecontext: parseProviderModel(largecontext as string),
        };
      }

      // Create a more compact and readable display of the configuration
      const formatProviderInfo = (provider: string, model: string) => {
        // Trim the provider prefix from the model name if it exists
        const modelDisplay = model.includes('/') ? model.split('/').pop() : model;
        return `${colors.cyan(provider.charAt(0).toUpperCase() + provider.slice(1))} ${colors.gray('→')} ${colors.green(modelDisplay || model)}`;
      };

      const configDisplay = Object.entries(config)
        .map(([key, value]) => {
          if (key === 'ide') return `IDE: ${colors.magenta(String(value))}`;
          if (!value) return null; // Skip undefined values
          const configVal = value as { provider: string; model: string };
          // Format key as "Coding:" instead of "coding:"
          const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
          return `${colors.yellow(formattedKey)}: ${formatProviderInfo(configVal.provider, configVal.model)}`;
        })
        .filter(Boolean) // Remove null entries
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

      // Handle IDE-specific rules setup using switch-case
      // Declare variables outside switch to avoid lexical declaration errors
      let rulesPath: string;
      let rulesTemplate: string;
      let rulesDir: string;
      let cursorPath: string;

      switch (selectedIde) {
        case 'cursor':
          // For cursor, create the new directory structure
          // Create necessary directories
          rulesDir = join(absolutePath, '.cursor', 'rules');
          ensureDirectoryExists(rulesDir);

          // Write the rules file directly to the new location
          cursorPath = join(rulesDir, 'vibe-tools.mdc');
          try {
            writeFileSync(cursorPath, generateRules('cursor'));
            consola.success(`Rules written to ${colors.cyan(cursorPath)}`);
          } catch (error) {
            consola.error(`${colors.red('Error writing rules for cursor:')}`, error);
            return;
          }
          break;

        case 'claude-code':
          rulesTemplate = generateRules('claude-code');
          rulesPath = isLocalConfig
            ? join(absolutePath, 'CLAUDE.md')
            : join(CLAUDE_HOME_DIR, 'CLAUDE.md');
          ensureDirectoryExists(join(rulesPath, '..'));
          updateRulesSection(rulesPath, rulesTemplate);
          consola.success(`Claude Code rules updated in ${colors.cyan(rulesPath)}`);
          break;

        case 'codex':
          rulesTemplate = generateRules('codex');
          rulesPath = isLocalConfig
            ? join(absolutePath, CODEX_LOCAL_INSTRUCTIONS_FILENAME)
            : CODEX_GLOBAL_INSTRUCTIONS_PATH;
          ensureDirectoryExists(join(rulesPath, '..'));
          updateRulesSection(rulesPath, rulesTemplate);
          consola.success(`Codex instructions updated in ${colors.cyan(rulesPath)}`);
          break;

        case 'windsurf':
          rulesPath = join(absolutePath, '.windsurfrules');
          rulesTemplate = generateRules('windsurf');
          ensureDirectoryExists(join(rulesPath, '..'));
          updateRulesSection(rulesPath, rulesTemplate);
          consola.success(`Updated .windsurfrules at ${colors.cyan(rulesPath)}`);
          break;

        case 'cline':
        case 'roo':
          await setupClinerules(absolutePath, selectedIde, generateRules);
          break;
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

      consola.success('✨ All done! Vibe-Tools is ready to rock. ✨');
      consola.info(
        `\n${colors.cyan('Tip:')} Ask your AI agent to use vibe-tools web to find out what the latest OpenAI news is.\n`
      );
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
          `If you need assistance, reach out to the vibe-tools team or try re-running the installation.`,
        ].join('\n'),
      });
    }
  }
}
