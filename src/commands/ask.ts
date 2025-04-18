import type { Command, CommandGenerator, CommandOptions, Provider } from '../types';
import { loadEnv, loadConfig, defaultMaxTokens } from '../config';
import { createProvider } from '../providers/base';
import { ProviderError, ModelNotFoundError } from '../errors';
import { getAllProviders } from '../utils/providerAvailability';
import type { ModelOptions } from '../providers/base';
import { fetchDocContent } from '../utils/fetch-doc.ts';

export class AskCommand implements Command {
  private config;
  constructor() {
    // Load environment variables and configuration.
    loadEnv();
    this.config = loadConfig();
  }

  async *execute(query: string, options?: CommandOptions): CommandGenerator {
    // Get available providers
    const availableProviders = getAllProviders().filter((p) => p.available);

    // If no providers are available, throw an error
    if (availableProviders.length === 0) {
      throw new ProviderError(
        "No AI providers are currently available. Please run 'vibe-tools install' to set up your API keys."
      );
    }

    // Use provided provider or default to the first available one
    const providerName = options?.provider || availableProviders[0].provider;

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
    let model = options?.model;
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

    // Create the provider instance
    const provider = createProvider(providerName);
    const maxTokens = options?.maxTokens || defaultMaxTokens;

    let finalQuery = query;

    // Check if the --with-doc flag is used
    if (options?.withDoc) {
      if (typeof options.withDoc !== 'string' || !options.withDoc.trim()) {
        console.error(
          'Warning: --with-doc flag used but no valid URL was provided. Proceeding without document context.'
        );
      } else {
        try {
          // FetchDocContent now returns cleaned text directly
          console.log(`Fetching and extracting text from document: ${options.withDoc}`);
          const cleanedText = await fetchDocContent(options.withDoc, options.debug ?? false);
          // Log statement for successful fetch/extraction is now inside fetchDocContent

          // Check if the extraction returned any significant text
          if (cleanedText && cleanedText.trim().length > 0) {
            // Prepend the cleaned document content to the original query
            // Ensure backticks in the text are escaped if the text is wrapped in backticks in the prompt
            const escapedCleanedText = cleanedText.replace(/`/g, '\\\\`');
            finalQuery = `Document Content:\\n\`\`\`\\n${escapedCleanedText}\\n\`\`\`\\n\\nQuestion:\\n${query}`;
          } else {
            console.warn(
              'fetchDocContent returned empty or whitespace-only text. Proceeding without document context.'
            );
            // finalQuery remains the original query
          }
        } catch (fetchExtractError) {
          // Error message from fetchDocContent should indicate if it was fetch or extraction
          console.error(
            `Error during document fetch/extraction: ${fetchExtractError instanceof Error ? fetchExtractError.message : String(fetchExtractError)}`
          );
          console.error('Proceeding with original query due to error processing document.');
          // Fallback: finalQuery remains the original query
        }
      }
    }

    let answer: string;
    try {
      // Build the model options
      const modelOptions: ModelOptions = {
        model,
        maxTokens,
        debug: options?.debug,
        systemPrompt:
          'You are a helpful assistant. Answer the following question directly and concisely.',
        reasoningEffort: options?.reasoningEffort ?? this.config.reasoningEffort,
      };

      // Execute the prompt with the provider using the potentially modified query
      answer = await provider.executePrompt(finalQuery, modelOptions);
    } catch (error) {
      throw new ProviderError(
        error instanceof Error ? error.message : 'Unknown error during ask command execution',
        error
      );
    }

    // Yield the answer as the result
    yield answer;
  }
}
