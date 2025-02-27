import type { Config } from './types';

// 8000 is the max tokens for the perplexity models
// most openai and anthropic models are 8192
// so we just use 8000 for all the defaults so people have a fighting chance of not hitting the limits
export const defaultMaxTokens = 8000;
export const defaultConfig: Config = {
  web: {
    provider: 'perplexity',
  },
  plan: {
    fileProvider: 'gemini',
    thinkingProvider: 'openai',
    fileMaxTokens: defaultMaxTokens,
    thinkingMaxTokens: defaultMaxTokens,
  },
  repo: {
    provider: 'gemini',
    maxTokens: defaultMaxTokens,
  },
  doc: {
    maxRepoSizeMB: 100,
    provider: 'perplexity',
    maxTokens: defaultMaxTokens,
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
    maxTokens: defaultMaxTokens,
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
  //   "docs": {
  //     "provider": "gemini",
  //   }
  //
  // You can also configure MCP server overrides:
  //
  //   "mcp": {
  //     "overrides": {
  //       "my-server": {
  //         "githubUrl": "https://github.com/myuser/my-server",
  //         "command": "npx",
  //         "args": ["-y", "github:myuser/my-server@main"]
  //       }
  //     }
  //   }
};

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import dotenv from 'dotenv';
import { once } from './utils/once';

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

export const loadEnv = once(_loadEnv);

function _loadEnv(): void {
  // Try loading from current directory first
  const localEnvPath = join(process.cwd(), '.cursor-tools.env');
  console.log(`Checking for local .env file at: ${localEnvPath}`);
  if (existsSync(localEnvPath)) {
    console.log('Local .env file found, loading...');
    dotenv.config({ path: localEnvPath });
    return;
  }

  // If local env doesn't exist, try home directory
  const homeEnvPath = join(homedir(), '.cursor-tools', '.env');
  console.log(`Checking for home .env file at: ${homeEnvPath}`);
  if (existsSync(homeEnvPath)) {
    console.log('Home .env file found, loading...');
    dotenv.config({ path: homeEnvPath });
    return;
  }

  // If neither env file exists, continue without loading
  console.log('No .env file found in local or home directories.');
  return;
}
