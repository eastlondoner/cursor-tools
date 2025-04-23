import type { Command, CommandGenerator, CommandOptions, Provider } from '../types.ts';
import type { Config } from '../types.ts';
import { defaultMaxTokens, loadConfig, loadEnv } from '../config.ts';
import { createProvider } from '../providers/base';
import { ProviderError } from '../errors';
import {
  getAllProviders,
  getNextAvailableProvider,
  getDefaultModel,
} from '../utils/providerAvailability';

const DEFAULT_WEB_MODELS: Record<Provider, string> = {
  gemini: 'gemini-2.5-pro-exp',
  openai: 'NO WEB SUPPORT',
  perplexity: 'sonar-pro',
  openrouter: 'google/gemini-2.5-pro-exp-03-25:free',
  modelbox: 'google/gemini-2.5-pro-exp',
  xai: 'NO WEB SUPPORT',
  anthropic: 'NO WEB SUPPORT',
};

export class WebCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    try {
      // If provider is explicitly specified, try only that provider
      if (options?.provider) {
        const providerInfo = getAllProviders().find((p) => p.provider === options.provider);
        if (!providerInfo?.available) {
          throw new ProviderError(
            `Provider ${options.provider} is not available. Please check your API key configuration.`,
            `Try one of ${getAllProviders()
              .filter((p) => p.available)
              .join(', ')}`
          );
        }
        yield* this.tryProvider(options.provider as Provider, query, options);
        return;
      }

      // Otherwise try providers in preference order
      let currentProvider = getNextAvailableProvider('web');
      while (currentProvider) {
        try {
          yield* this.tryProvider(currentProvider, query, options);
          return; // If successful, we're done
        } catch (error) {
          console.error(
            `Provider ${currentProvider} failed:`,
            error instanceof Error ? error.message : error
          );
          yield `Provider ${currentProvider} failed, trying next available provider...\n`;
          currentProvider = getNextAvailableProvider('web', currentProvider);
        }
      }

      // If we get here, no providers worked
      throw new ProviderError(
        'No suitable AI provider available for web command. Please ensure at least one of the following API keys are set: PERPLEXITY_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, MODELBOX_API_KEY.'
      );
    } catch (error) {
      if (error instanceof Error) {
        yield `Error: ${error.message}`;
        if (options?.debug) {
          console.error('Detailed error:', error);
        }
      } else {
        yield 'An unknown error occurred';
        if (options?.debug) {
          console.error('Unknown error:', error);
        }
      }
    }
  }

  private async *tryProvider(
    provider: Provider,
    query: string,
    options: CommandOptions
  ): CommandGenerator {
    const modelProvider = createProvider(provider);
    let model =
      options?.model ||
      this.config.web?.model ||
      (this.config as Record<string, any>)[provider]?.model ||
      DEFAULT_WEB_MODELS[provider] ||
      getDefaultModel(provider);

    // Check web search capability
    const SAFETY_OVERRIDE = process.env.OVERRIDE_SAFETY_CHECKS?.toLowerCase();
    const isOverridden = SAFETY_OVERRIDE === 'true' || SAFETY_OVERRIDE === '1';

    const webSearchSupport = await modelProvider.supportsWebSearch(model);
    if (!isOverridden && !webSearchSupport.supported) {
      if (webSearchSupport.model) {
        console.log(`Using ${webSearchSupport.model} instead of ${model} for web search`);
        model = webSearchSupport.model;
      } else {
        throw new ProviderError(webSearchSupport.error || 'Provider does not support web search');
      }
    }

    if (
      isOverridden &&
      (!webSearchSupport.supported || (webSearchSupport.model && model !== webSearchSupport.model))
    ) {
      console.log(
        `Warning: Web search compatibility check bypassed via OVERRIDE_SAFETY_CHECKS.\n` +
          `Using ${model} instead of ${webSearchSupport.model} for web search.\n` +
          `This may result in errors or unexpected behavior.`
      );
    }

    const maxTokens =
      options?.maxTokens ||
      this.config.web?.maxTokens ||
      (this.config as Record<string, any>)[provider]?.maxTokens ||
      defaultMaxTokens;

    yield `Querying ${provider} using ${model} for: ${query} with maxTokens: ${maxTokens}\n`;

    const response = await modelProvider.executePrompt(query, {
      model,
      maxTokens,
      debug: options.debug,
      webSearch: true,
      systemPrompt:
        "You are an expert software engineering assistant. Follow user instructions exactly and satisfy the user's request. Always Search the web for the latest information, even if you think you know the answer.",
    });

    yield response;
  }
}
