import type { Command, CommandGenerator, CommandOptions, Provider, TokenUsage } from '../types.ts';
import type { Config } from '../types.ts';
import { defaultMaxTokens, loadConfig, loadEnv } from '../config.ts';
import { createProvider } from '../providers/base';
import { ProviderError } from '../errors';
import {
  getAllProviders,
  getNextAvailableProvider,
  getDefaultModel,
} from '../utils/providerAvailability';
import { trackEvent } from '../telemetry';

const DEFAULT_WEB_MODELS: Record<Provider, string> = {
  gemini: 'gemini-2.5-pro-exp',
  openai: 'NO WEB SUPPORT',
  perplexity: 'sonar-pro',
  openrouter: 'google/gemini-2.5-pro-exp-03-25:free',
  modelbox: 'google/gemini-2.5-pro-exp',
  anthropic: 'NO WEB SUPPORT',
  xai: 'NO WEB SUPPORT',
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
    const commandStartTime = Date.now(); // Record start time
    let usage: TokenUsage | undefined;
    let finalStatus: 'success' | 'failure' = 'failure'; // Assume failure initially
    let errorDetails: Record<string, any> | undefined = undefined;
    let model: string | undefined = undefined; // Initialize model

    try {
      const modelProvider = createProvider(provider);
      model =
        options?.model ||
        this.config.web?.model ||
        (this.config as Record<string, any>)[provider]?.model ||
        DEFAULT_WEB_MODELS[provider] ||
        getDefaultModel(provider);

      // model is guaranteed to be a string after this block
      if (!model) {
        throw new ProviderError('Could not determine a valid model for web search.');
      }

      // Check web search capability
      const SAFETY_OVERRIDE = process.env.OVERRIDE_SAFETY_CHECKS?.toLowerCase();
      const isOverridden = SAFETY_OVERRIDE === 'true' || SAFETY_OVERRIDE === '1';

      // Now model is guaranteed to be a string
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
        (!webSearchSupport.supported ||
          (webSearchSupport.model && model !== webSearchSupport.model))
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

      // Define token usage callback
      const tokenUsageCallback = (tokenData: TokenUsage) => {
        usage = tokenData;
      };

      // model is guaranteed to be a string here
      const response = await modelProvider.executePrompt(query, {
        model, // Pass the guaranteed string model
        maxTokens,
        debug: options.debug,
        webSearch: true,
        systemPrompt:
          "You are an expert software engineering assistant. Follow user instructions exactly and satisfy the user's request. Always Search the web for the latest information, even if you think you know the answer.",
        tokenUsageCallback,
      });

      // NO separate token_usage event
      finalStatus = 'success';

      yield response;
    } catch (error) {
      finalStatus = 'failure';
      errorDetails = {
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
        provider: provider,
        model: model, // Capture model used during failure if available
      };
      // Re-throw the error to be caught by the main execute loop
      throw error;
    } finally {
      // Always track the completion event for this provider attempt
      const durationMs = Date.now() - commandStartTime;

      const properties: Record<string, any> = {
        command: 'web', // Explicitly state command for clarity
        status: finalStatus,
        provider: provider,
        model: model!, // Assert non-null (set above or default)
        duration_ms: durationMs,
        input_tokens: usage?.inputTokens,
        output_tokens: usage?.outputTokens,
        total_tokens: usage?.totalTokens,
        save_to: !!options?.saveTo,
        debug: !!options?.debug,
      };

      if (errorDetails) {
        properties.error = errorDetails;
      }

      // Use a specific event name indicating a provider attempt
      await trackEvent('web_provider_attempt_completed', properties, options?.debug).catch((e) => {
        if (options?.debug) console.error('Telemetry error for web_provider_attempt_completed:', e);
      });
    }
  }
}
