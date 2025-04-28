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
    let docContent = ''; // Variable to store fetched document content

    // Check if the --with-doc flag is used and is an array with elements
    if (options?.withDoc && Array.isArray(options.withDoc) && options.withDoc.length > 0) {
      try {
        console.log(`Fetching and extracting text from documents: ${options.withDoc.join(', ')}`);
        docContent = await fetchDocContent(options.withDoc, options.debug ?? false);

        if (docContent && docContent.trim().length > 0) {
          // Prepend the combined document content to the original query
          const escapedDocContent = docContent.replace(/`/g, '\\\\`');
          finalQuery = `--- Document Context ---\n${escapedDocContent}\n--- End Document Context ---\n\nQuestion:\n${query}`;
        } else {
          console.warn(
            'fetchDocContent returned empty or whitespace-only text. Proceeding without document context.'
          );
        }
      } catch (fetchExtractError) {
        console.error(
          `Error during document fetch/extraction: ${fetchExtractError instanceof Error ? fetchExtractError.message : String(fetchExtractError)}`
        );
        console.error('Proceeding with original query due to error processing document.');
      }
    } else if (options?.withDoc) {
      // Handle case where --with-doc might still be a string or empty array due to parsing fallback/edge cases
      console.warn(
        '--with-doc was provided but not as a non-empty array of URLs. Proceeding without document context.'
      );
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
