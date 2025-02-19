import { z } from 'zod';

// Define available models
const anthropicModels = z.enum(['claude-3-5-sonnet-latest']);
const openaiModels = z.enum(['o3-mini', 'gpt-4o']);
// Allow any string for Groq models since they change frequently
export const availableModels = z.union([anthropicModels, openaiModels, z.string()]);

export type AvailableModel = z.infer<typeof availableModels>;

export interface StagehandConfig {
  provider: 'anthropic' | 'openai' | 'groq';
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
  let provider: 'anthropic' | 'openai' | 'groq' | undefined = stagehandConfig.provider?.toLowerCase() as any;

  if (!provider) {
    // Set provider based on available API keys
    if (process.env.ANTHROPIC_API_KEY) {
      provider = 'anthropic';
      if (process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY) {
        console.log('Defaulting to anthropic as AI provider for Stagehand');
      }
    } else if (process.env.OPENAI_API_KEY) {
      provider = 'openai';
      if (process.env.GROQ_API_KEY) {
        console.log('Defaulting to openai as AI provider for Stagehand');
      }
    } else if (process.env.GROQ_API_KEY) {
      provider = 'groq';
    } else {
      throw new Error(
        'Either ANTHROPIC_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY is required for Stagehand. Please set one in your environment or add it to ~/.cursor-tools/.env file.'
      );
    }
  } else {
    switch (provider) {
      case 'anthropic': {
        if (!process.env.ANTHROPIC_API_KEY) {
          throw new Error(
            'ANTHROPIC_API_KEY is required when Stagehand is configured to use Anthropic. Please set one in your environment or add it to ~/.cursor-tools/.env file.'
          );
        }
        break;
      }
      case 'openai': {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error(
            'OPENAI_API_KEY is required when Stagehand is configured to use OpenAI. Please set one in your environment or add it to ~/.cursor-tools/.env file.'
          );
        }
        break;
      }
      case 'groq': {
        if (!process.env.GROQ_API_KEY) {
          throw new Error(
            'GROQ_API_KEY is required when Stagehand is configured to use Groq. Please set one in your environment or add it to ~/.cursor-tools/.env file.'
          );
        }
        break;
      }
      default:
        throw new Error('Unrecognized AI provider for stagehand ' + provider);
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

  if (!config.provider || !['anthropic', 'openai', 'groq'].includes(config.provider)) {
    throw new Error('Invalid Stagehand provider. Must be either "anthropic", "openai", or "groq".');
  }

  // Get the effective provider based on model if specified
  const { provider } = getStagehandModel(config, { model: config.model });

  // Check for required API key based on provider
  let requiredKey: string;
  switch (provider) {
    case 'anthropic':
      requiredKey = 'ANTHROPIC_API_KEY';
      break;
    case 'openai':
      requiredKey = 'OPENAI_API_KEY';
      break;
    case 'groq':
      requiredKey = 'GROQ_API_KEY';
      break;
  }

  if (!process.env[requiredKey]) {
    throw new Error(
      `${requiredKey} is required for Stagehand ${provider} provider. ` +
        `Please set it in your .cursor-tools.env file.`
    );
  }
}

export function getStagehandApiKey(config: StagehandConfig): string {
  let apiKey: string | undefined;
  switch (config.provider) {
    case 'anthropic':
      apiKey = process.env.ANTHROPIC_API_KEY;
      break;
    case 'openai':
      apiKey = process.env.OPENAI_API_KEY;
      break;
    case 'groq':
      apiKey = process.env.GROQ_API_KEY;
      break;
  }

  if (!apiKey) {
    const keyName = `${config.provider.toUpperCase()}_API_KEY`;
    throw new Error(
      `API key not found for ${config.provider} provider. ` +
        `Please set ${keyName} in your .cursor-tools.env file.`
    );
  }

  return apiKey;
}

function getProviderFromModel(modelName: string): 'anthropic' | 'openai' | 'groq' {
  if (modelName.startsWith('claude')) {
    return 'anthropic';
  } else if (modelName.startsWith('gpt') || modelName.startsWith('o3')) {
    return 'openai';
  } else {
    // Assume Groq if it does not start with claude, gpt or o3
    return 'groq';
  }
}

export function getStagehandModel(
  config: StagehandConfig,
  options?: { model?: string }
): { model: AvailableModel | undefined; provider: 'anthropic' | 'openai' | 'groq' } {
  const modelToUse = options?.model ?? config.model;

  if (modelToUse) {
    const parseAttempt = availableModels.safeParse(modelToUse);
    if (parseAttempt.success) {
      // Valid model, use it
      const provider = getProviderFromModel(parseAttempt.data);
      return { model: parseAttempt.data, provider };
    }
    // If model to use is invalid but there's a provider, log and use default for provider
    console.warn(
      `Warning: Using unfamiliar model "${modelToUse}" this may be a mistake. ` +
        `Typical models are "claude-3-5-sonnet-latest" for Anthropic and "o3-mini" or "gpt-4o" for OpenAI.`
    );
    return { model: modelToUse as AvailableModel, provider: getProviderFromModel(modelToUse) };
  }

  // Otherwise use defaults based on provider
  switch (config.provider as 'anthropic' | 'openai' | 'groq') {
    case 'anthropic': {
      return { model: 'claude-3-5-sonnet-latest', provider: 'anthropic' };
    }
    case 'openai': {
      return { model: 'o3-mini', provider: 'openai' };
    }
    case 'groq': {
      return { model: 'deepseek-r1-distill-llama-70b', provider: 'groq' }; // No default model for Groq
    }
  }
}
