import { z } from 'zod';
import { exhaustiveMatchGuard } from '../../../utils/exhaustiveMatchGuard';

// Define available models
export const availableModels = z.enum(['claude-3-7-sonnet-latest', 'o3-mini', 'gpt-4o']);

export type AvailableModel = z.infer<typeof availableModels>;

export interface StagehandConfig {
  provider: 'anthropic' | 'openai';
  headless: boolean;
  verbose: boolean;
  debugDom: boolean;
  enableCaching: boolean;
  timeout?: number;
  model?: string;
}

interface BrowserConfig {
  headless?: boolean;
  defaultViewport?: string;
  timeout?: number;
  stagehand?: {
    provider?: string;
    headless?: boolean;
    verbose?: boolean;
    debugDom?: boolean;
    enableCaching?: boolean;
    timeout?: number;
    model?: string;
  };
}

interface Config {
  browser?: BrowserConfig;
}

export function loadStagehandConfig(config: Config): StagehandConfig {
  const browserConfig = config.browser || {};
  const stagehandConfig = browserConfig.stagehand || {};

  // Set default values
  const headless = stagehandConfig.headless ?? true;
  const verbose = stagehandConfig.verbose ?? false;
  const debugDom = stagehandConfig.debugDom ?? false;
  const enableCaching = stagehandConfig.enableCaching ?? false;
  const timeout = stagehandConfig.timeout ?? 120000;
  let provider: 'anthropic' | 'openai' | undefined = stagehandConfig.provider?.toLowerCase() as any;

  if (!provider) {
    // Set provider based on available API keys
    if (process.env.ANTHROPIC_API_KEY) {
      provider = 'anthropic';
      if (process.env.OPENAI_API_KEY) {
        console.log('Defaulting to anthropic as AI provider for Stagehand');
      }
    } else if (process.env.OPENAI_API_KEY) {
      provider = 'openai';
    } else {
      throw new Error(
        'Either ANTHROPIC_API_KEY or OPENAI_API_KEY is required for Stagehand. Please set one in your environment or add it to ~/.vibe-tools/.env file.'
      );
    }
  } else {
    switch (provider) {
      case 'anthropic': {
        if (!process.env.ANTHROPIC_API_KEY) {
          throw new Error(
            'ANTHROPIC_API_KEY is required for when Stagehand is configured to use Anthropic. Please set one in your environment or add it to ~/.vibe-tools/.env file.'
          );
        }
        break;
      }
      case 'openai': {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error(
            'OPENAI_API_KEY is required for when Stagehand is configured to use OpenAI. Please set one in your environment or add it to ~/.vibe-tools/.env file.'
          );
        }
        break;
      }
      default:
        throw exhaustiveMatchGuard(provider, 'Unrecognized AI provider for stagehand');
    }
  }

  return {
    provider,
    headless,
    verbose,
    debugDom,
    enableCaching,
    timeout,
    model: stagehandConfig.model,
  };
}

export function validateStagehandConfig(config: StagehandConfig): void {
  if (!config) {
    throw new Error('Stagehand configuration is missing');
  }

  if (!config.provider || !['anthropic', 'openai'].includes(config.provider)) {
    throw new Error('Invalid Stagehand provider. Must be either "anthropic" or "openai".');
  }

  // Check for required API key based on provider
  const requiredKey = config.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
  if (!process.env[requiredKey]) {
    throw new Error(
      `${requiredKey} is required for Stagehand ${config.provider} provider. ` +
        `Please set it in your .vibe-tools.env file.`
    );
  }
}

export function getStagehandApiKey(config: StagehandConfig): string {
  const apiKey =
    config.provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      `API key not found for ${config.provider} provider. ` +
        `Please set ${config.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} ` +
        `in your .vibe-tools.env file.`
    );
  }

  return apiKey;
}

/**
 * Get the Stagehand model to use based on the following precedence:
 * 1. Command line option (--model)
 * 2. Configuration file (vibe-tools.config.json)
 * 3. Default model based on provider (claude-3-7-sonnet for Anthropic, o3-mini for OpenAI)
 *
 * If both command line and config models are invalid, falls back to the default model for the provider.
 *
 * @param config The Stagehand configuration
 * @param options Optional command line options
 * @returns The model to use
 */
export function getStagehandModel(
  config: StagehandConfig,
  options?: { model?: string }
): AvailableModel {
  // If a model is specified (via command line or config), validate and use it
  const modelToUse = options?.model ?? config.model;
  if (modelToUse) {
    const parseAttempt = availableModels.safeParse(modelToUse);
    if (parseAttempt.success) {
      return parseAttempt.data;
    }
    console.warn(
      `Warning: Using unfamiliar model "${modelToUse}" this may be a mistake. ` +
        `Typical models are "claude-3-7-sonnet-latest" for Anthropic and "o3-mini" or "gpt-4o" for OpenAI.`
    );
    return modelToUse as AvailableModel;
  }

  // Otherwise use defaults based on provider
  switch (config.provider) {
    case 'anthropic': {
      return 'claude-3-7-sonnet-latest';
    }
    case 'openai': {
      return 'o3-mini';
    }
  }
}
