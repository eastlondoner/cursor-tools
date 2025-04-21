import type { Command, CommandGenerator, CommandOptions, Provider, TokenUsage } from '../types';
import { loadEnv, loadConfig, defaultMaxTokens } from '../config';
import { createProvider } from '../providers/base';
import { ProviderError, ModelNotFoundError } from '../errors';
import { getAllProviders } from '../utils/providerAvailability';
import type { ModelOptions } from '../providers/base';
import { trackEvent } from '../telemetry';

export class AskCommand implements Command {
  private config;
  constructor() {
    // Load environment variables and configuration.
    loadEnv();
    this.config = loadConfig();
  }

  async *execute(query: string, options?: CommandOptions): CommandGenerator {
    const commandStartTime = Date.now(); // Record start time
    let usage: TokenUsage | undefined;
    let providerName: Provider;
    let model: string | undefined = options?.model;
    let finalStatus: 'success' | 'failure' = 'failure'; // Assume failure initially
    let errorDetails: Record<string, any> | undefined = undefined;

    try {
      // Get available providers
      const availableProviders = getAllProviders().filter((p) => p.available);

      // If no providers are available, throw an error
      if (availableProviders.length === 0) {
        throw new ProviderError(
          "No AI providers are currently available. Please run 'vibe-tools install' to set up your API keys."
        );
      }

      // Use provided provider or default to the first available one
      providerName = options?.provider || availableProviders[0].provider;

      // Check if the requested provider is available
      const providerInfo = getAllProviders().find((p) => p.provider === providerName);
      if (!providerInfo) {
        throw new ProviderError(
          `Invalid provider: ${providerName}.\n` +
            'Available providers:\n' +
            availableProviders.map((p) => `- ${p.provider}`).join('\n')
        );
      }
      if (!providerInfo.available) {
        throw new ProviderError(
          `The ${providerName} provider is not available. Please set ${providerName.toUpperCase()}_API_KEY in your environment.\n` +
            'Currently available providers:\n' +
            availableProviders.map((p) => `- ${p.provider}`).join('\n')
        );
      }

      // Use provided model or get default model for the provider
      if (!model) {
        // Default models for each provider
        const defaultModels: Record<Provider, string> = {
          openai: 'gpt-3.5-turbo',
          anthropic: 'claude-3-haiku-20240307',
          gemini: 'gemini-2.5-pro-exp-03-25',
          perplexity: 'sonar-pro',
          openrouter: 'openai/gpt-3.5-turbo',
          modelbox: 'openai/gpt-3.5-turbo',
          xai: 'grok-3-mini-latest',
        };

        model = defaultModels[providerName] || 'gpt-3.5-turbo';
        console.log(`No model specified, using default model for ${providerName}: ${model}`);
      }

      // Set maxTokens from provided options or fallback to the default
      const maxTokens = options?.maxTokens || defaultMaxTokens;

      // Create the provider instance
      const provider = createProvider(providerName);
      let answer: string;

      // Define the token usage callback
      const tokenUsageCallback = (tokenData: TokenUsage) => {
        usage = tokenData;
      };

      try {
        // Build the model options
        const modelOptions: ModelOptions = {
          model,
          maxTokens,
          debug: options?.debug,
          systemPrompt:
            'You are a helpful assistant. Answer the following question directly and concisely.',
          reasoningEffort: options?.reasoningEffort ?? this.config.reasoningEffort,
          tokenUsageCallback,
        };

        // Execute the prompt with the provider
        answer = await provider.executePrompt(query, modelOptions);

        finalStatus = 'success'; // Set status to success
      } catch (error) {
        finalStatus = 'failure';
        errorDetails = {
          error_message: error instanceof Error ? error.message : String(error),
          error_stack: error instanceof Error ? error.stack : undefined,
        };
        throw new ProviderError(
          error instanceof Error ? error.message : 'Unknown error during ask command execution',
          error
        );
      }

      // Yield the answer as the result
      yield answer;
    } finally {
      // Always track the completion event in a finally block
      const durationMs = Date.now() - commandStartTime;

      // Construct properties object first
      const properties: Record<string, any> = {
        status: finalStatus,
        provider: providerName!, // Assert non-null as it's set early
        model: model!, // Assert non-null as it's guaranteed to be set
        duration_ms: durationMs,
        input_tokens: usage?.inputTokens,
        output_tokens: usage?.outputTokens,
        total_tokens: usage?.totalTokens,
        save_to: !!options?.saveTo,
        debug: !!options?.debug,
      };

      // Conditionally add error details
      if (errorDetails) {
        properties.error = errorDetails;
      }

      await trackEvent(
        'ask_completed',
        properties, // Pass the constructed properties object
        options?.debug
      );
    }
  }
}
