import type { Config } from './types';

export const defaultConfig: Config = {
  web: {
    provider: 'perplexity',
  },
  plan: {
    fileProvider: 'gemini',
    thinkingProvider: 'perplexity',
    fileModel: 'gemini-2.0-pro-exp',
    thinkingModel: 'sonar-reasoning-pro',
    fileMaxTokens: 8192,
    thinkingMaxTokens: 8192,
  },
  repo: {
    provider: 'perplexity',
    model: 'sonar-reasoning-pro',
    maxTokens: 10000,
  },
  doc: {
    maxRepoSizeMB: 100,
    provider: 'perplexity',
    maxTokens: 10000,
  },
  browser: {
    headless: true,
    defaultViewport: '1280x720',
    timeout: 120000,
  },
  stagehand: {
    provider: 'anthropic',
    verbose: false,
    debugDom: false,
    enableCaching: true,
  },
  tokenCount: {
    encoding: 'o200k_base',
  },
  perplexity: {
    model: 'sonar-pro',
    maxTokens: 8000,
  },

  // Note that it is also permitted to add provider-specific config options
  // in the config file, even though they are not shown in this interface.
  // command specific configuration always overrides the provider specific
  // configuration
  //   modelbox: {
  //     model: 'google/gemini-2.0-flash', // Default model, can be overridden per command
  //     maxTokens: 8192,
  //  },
  //  openrouter: {
  //   model: 'google/gemini-2.0-pro-exp-02-05:free'
  //   }
  //
  //  or
  //
  //   "gemini": {
  //     "model": "gemini-2.0-pro-exp",
  //     "maxTokens": 10000
  //   }
  //
  //  or
  //
  //   "openai": {
  //     "model": "gpt-4o",
  //     "maxTokens": 10000
  //   }
  //
  // these would apply if the command was run with the --provider flag
  // or if provider is configured for a command without additional fields
  // e.g.
  //
  //   "repo": {
  //     "provider": "openai",
  //   }
  //
  // or
  //
  //   "docs": {
  //     "provider": "gemini",
  //   }
};

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import dotenv from 'dotenv';

export function loadConfig(): Config {
  // Try loading from current directory first
  try {
    const localConfigPath = join(process.cwd(), 'cursor-tools.config.json');
    const localConfig = JSON.parse(readFileSync(localConfigPath, 'utf-8'));
    return { ...defaultConfig, ...localConfig };
  } catch {
    // If local config doesn't exist, try home directory
    try {
      const homeConfigPath = join(homedir(), '.cursor-tools', 'config.json');
      const homeConfig = JSON.parse(readFileSync(homeConfigPath, 'utf-8'));
      return { ...defaultConfig, ...homeConfig };
    } catch {
      // If neither config exists, return default config
      return defaultConfig;
    }
  }
}

export function loadEnv(): void {
  // Try loading from current directory first
  const localEnvPath = join(process.cwd(), '.cursor-tools.env');
  if (existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath });
    return;
  }

  // If local env doesn't exist, try home directory
  const homeEnvPath = join(homedir(), '.cursor-tools', '.env');
  if (existsSync(homeEnvPath)) {
    dotenv.config({ path: homeEnvPath });
    return;
  }

  // If neither env file exists, continue without loading
  return;
}
