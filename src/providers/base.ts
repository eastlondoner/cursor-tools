import type { Config } from '../types';
import { loadConfig, loadEnv } from '../config';
import OpenAI from 'openai';
import { ApiKeyMissingError, ModelNotFoundError, NetworkError, ProviderError } from '../errors';
import { exhaustiveMatchGuard } from '../utils/exhaustiveMatchGuard';
import { chunkMessage } from '../utils/messageChunker';
import Anthropic from '@anthropic-ai/sdk';
import { stringSimilarity, getSimilarModels } from '../utils/stringSimilarity';
import { AuthClient, GoogleAuth } from 'google-auth-library';
import { existsSync } from 'fs';

const TEN_MINUTES = 600000;
// Interfaces for Gemini response types
interface GeminiGroundingChunk {
  web?: {
    uri: string;
    title?: string;
  };
}

interface GeminiGroundingSupport {
  segment: {
    startIndex?: number;
    endIndex?: number;
    text: string;
  };
  groundingChunkIndices: number[];
  confidenceScores?: number[];
}

interface GeminiGroundingMetadata {
  groundingChunks: GeminiGroundingChunk[];
  groundingSupports: GeminiGroundingSupport[];
  webSearchQueries?: string[];
}

// Request body types for Google APIs
interface GoogleVertexAIRequestBody {
  contents: { role: string; parts: { text: string }[] }[];
  generationConfig: { maxOutputTokens: number };
  system_instruction?: { parts: { text: string }[] };
  tools?: { google_search: Record<string, never> }[];
}

interface GoogleGenerativeLanguageRequestBody {
  contents: { parts: { text: string }[] }[];
  generationConfig: { maxOutputTokens: number };
  system_instruction?: { parts: { text: string }[] };
  tools?: { google_search: Record<string, never> }[];
}

// Common options for all providers
export interface ModelOptions {
  model: string;
  maxTokens: number;
  systemPrompt: string;
  tokenCount?: number; // For handling large token counts
  webSearch?: boolean; // Whether to enable web search capabilities
  timeout?: number; // Timeout in milliseconds for model API calls
  debug: boolean | undefined; // Enable debug logging
}

// Provider configuration in Config
export interface ProviderConfig {
  model?: string;
  maxTokens?: number;
  apiKey?: string;
  // OpenRouter-specific fields
  referer?: string;
  appName?: string;
  // Debug logging config
  debugLogMaxLength?: number; // Maximum length for debug log messages from this provider (in characters)
}

// Base provider interface that all specific provider interfaces will extend
export interface BaseModelProvider {
  executePrompt(prompt: string, options?: ModelOptions): Promise<string>;
  supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }>;
}

// Base provider class with common functionality
export abstract class BaseProvider implements BaseModelProvider {
  protected config: Config;
  protected availableModels?: Promise<Set<string>>;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  /**
   * Resolves a model name to an available model from the provider.
   * This method implements a multi-step resolution process:
   * 1. Try exact match with provider prefix
   * 2. Try exact match within any provider namespace
   * 3. Try prefix matching with various provider prefixes
   * 4. Try handling special suffixes like -latest or -exp
   * 5. Try finding similar models based on string similarity
   * 
   * If no match is found, it throws a ModelNotFoundError with helpful suggestions.
   * 
   * @param options The model options containing the requested model name
   * @returns The resolved model name that can be used with the provider's API
   * @throws ModelNotFoundError if no matching model is found
   */
  protected async getModel(options: ModelOptions | undefined): Promise<string> {
    if (!options?.model) {
      throw new ModelNotFoundError(this.constructor.name.replace('Provider', ''));
    }
    
    const model = options.model;
    
    // If models aren't initialized yet, return the requested model as-is
    if (!this.availableModels) {
      return model;
    }
    
    const availableModels = await this.availableModels;
    const modelWithoutPrefix = model.includes('/') ? model.split('/')[1] : model;
    
    // Try each resolution strategy in sequence
    const resolvedModel = 
      this.tryExactMatch(model, availableModels) || 
      this.tryProviderNamespaceMatch(model, modelWithoutPrefix, availableModels) ||
      this.tryPrefixMatch(model, modelWithoutPrefix, availableModels) ||
      this.trySuffixHandling(model, availableModels) ||
      this.tryExperimentalSuffixHandling(model, availableModels);
    
    if (resolvedModel) {
      return resolvedModel;
    }
    
    // If all resolution attempts fail, try to find similar models
    const similarModels = this.findSimilarModels(model, modelWithoutPrefix, availableModels);
    
    // If we found similar models, check if any contain the exact model string
    if (similarModels.length > 0) {
      // Check if the first similar model contains our exact model string
      if (similarModels[0].includes(model)) {
        console.log(
          `[${this.constructor.name}] Model '${model}' not found. Using similar model '${similarModels[0]}' that contains requested model string.`
        );
        return similarModels[0];
      }

      throw new ModelNotFoundError(
        `Model '${model}' not found in ${this.constructor.name.replace('Provider', '')}.\n\n` +
        `You requested: ${model}\n` +
        `Similar available models:\n${similarModels.map((m) => `- ${m}`).join('\n')}\n\n` +
        `Use --model with one of the above models.` +
        (this.constructor.name === 'ModelBoxProvider' || this.constructor.name === 'OpenRouterProvider' ? 
          ' Note: This provider requires provider prefixes (e.g., \'openai/gpt-4\' instead of just \'gpt-4\').' : '')
      );
    }

    // If no similar models found, show all available models sorted by recency
    const recentModels = Array.from(availableModels)
      .sort((a: string, b: string) => b.localeCompare(a)) // Sort in descending order

    throw new ModelNotFoundError(
      `Model '${model}' not found in ${this.constructor.name.replace('Provider', '')}.\n\n` +
        `You requested: ${model}\n` +
        `Recent available models:\n${recentModels.map((m) => `- ${m}`).join('\n')}\n\n` +
        `Use --model with one of the above models.` +
        (this.constructor.name === 'ModelBoxProvider' || this.constructor.name === 'OpenRouterProvider' ? 
          ' Note: This provider requires provider prefixes (e.g., \'openai/gpt-4\' instead of just \'gpt-4\').' : '')
    );
  }

  /**
   * Try to find an exact match for the model in the available models.
   * @param model The requested model name
   * @param availableModels Set of available models
   * @returns The matched model name or undefined if no match found
   */
  private tryExactMatch(model: string, availableModels: Set<string>): string | undefined {
    if (availableModels.has(model)) {
      return model;
    }
    return undefined;
  }

  /**
   * Try to find a match for the model within any provider namespace.
   * @param model The requested model name
   * @param modelWithoutPrefix The model name without provider prefix
   * @param availableModels Set of available models
   * @returns The matched model name or undefined if no match found
   */
  private tryProviderNamespaceMatch(
    model: string, 
    modelWithoutPrefix: string, 
    availableModels: Set<string>
  ): string | undefined {
    const exactMatchWithProvider = Array.from(availableModels).find(m => {
      const parts = m.split('/');
      return parts.length >= 2 && parts[1] === modelWithoutPrefix;
    });

    if (exactMatchWithProvider) {
      console.log(
        `[${this.constructor.name}] Using fully qualified model name '${exactMatchWithProvider}' for '${model}'.`
      );
      return exactMatchWithProvider;
    }
    return undefined;
  }

  /**
   * Try to find a match using various prefix matching strategies.
   * @param model The requested model name
   * @param modelWithoutPrefix The model name without provider prefix
   * @param availableModels Set of available models
   * @returns The matched model name or undefined if no match found
   */
  private tryPrefixMatch(
    model: string, 
    modelWithoutPrefix: string, 
    availableModels: Set<string>
  ): string | undefined {
    const matchingModels = Array.from(availableModels).filter(
      (m) =>
        m === model || // Exact match with prefix
        m.startsWith(`openai/${model}`) || // Try with openai prefix (allow for versions like openai/o3-mini-v1)
        m.endsWith(`/${modelWithoutPrefix}`) || // Match with any prefix
        m === modelWithoutPrefix // Exact match without prefix
    );

    if (matchingModels.length > 0) {
      const resolvedModel = matchingModels[0];
      console.log(
        `[${this.constructor.name}] Using prefix match '${resolvedModel}' for '${model}'.`
      );
      return resolvedModel;
    }
    return undefined;
  }

  /**
   * Try to handle models with -latest suffix by finding the latest version.
   * @param model The requested model name
   * @param availableModels Set of available models
   * @returns The matched model name or undefined if no match found
   */
  private trySuffixHandling(model: string, availableModels: Set<string>): string | undefined {
    if (model.endsWith('-latest')) {
      const modelWithoutLatest = model.slice(0, -'-latest'.length);
      const latestMatches = Array.from(availableModels)
        .filter((m: string) => m.startsWith(modelWithoutLatest))
        .sort((a: string, b: string) => b.localeCompare(a));

      if (latestMatches.length > 0) {
        const resolvedModel = latestMatches[latestMatches.length - 1];
        console.log(
          `[${this.constructor.name}] Model '${model}' not found. Using latest match '${resolvedModel}'.`
        );
        return resolvedModel;
      }
    }
    return undefined;
  }

  /**
   * Try to handle models with -exp or -exp-* suffix by finding a non-experimental version.
   * @param model The requested model name
   * @param availableModels Set of available models
   * @returns The matched model name or undefined if no match found
   */
  private tryExperimentalSuffixHandling(model: string, availableModels: Set<string>): string | undefined {
    const expMatch = model.match(/^(.*?)(?:-exp(?:-.*)?$)/);
    if (expMatch) {
      const modelWithoutExp = expMatch[1];
      const expMatches = Array.from(availableModels)
        .filter((m: string) => m.startsWith(modelWithoutExp))
        .sort((a: string, b: string) => b.localeCompare(a));

      if (expMatches.length > 0) {
        const resolvedModel = expMatches[expMatches.length - 1];
        console.log(
          `[${this.constructor.name}] Model '${model}' not found. Using non-experimental match '${resolvedModel}'.`
        );
        return resolvedModel;
      }
    }
    return undefined;
  }

  /**
   * Find similar models based on string similarity.
   * @param model The requested model name
   * @param modelWithoutPrefix The model name without provider prefix
   * @param availableModels Set of available models
   * @returns Array of similar model names
   */
  private findSimilarModels(
    model: string, 
    modelWithoutPrefix: string, 
    availableModels: Set<string>
  ): string[] {
    return getSimilarModels(model, availableModels);
  }

  protected getSystemPrompt(options?: ModelOptions): string | undefined {
    return (
      options?.systemPrompt || 'You are a helpful assistant. Provide clear and concise responses.'
    );
  }

  protected logRequestStart(
    options: ModelOptions,
    model: string,
    maxTokens: number,
    systemPrompt: string | undefined,
    endpoint: string,
    headers?: Record<string, string>
  ): void {
    this.debugLog(options, `Executing prompt with model: ${model}, maxTokens: ${maxTokens}`);
    this.debugLog(options, `API endpoint: ${endpoint}`);
    if (headers) {
      this.debugLog(options, 'Request headers:', this.truncateForLogging(headers));
    }
    if (systemPrompt) {
      this.debugLog(options, 'System prompt:', this.truncateForLogging(systemPrompt));
    }
  }

  protected handleLargeTokenCount(tokenCount: number): { model?: string; error?: string } {
    return {}; // Default implementation - no token count handling
  }

  protected debugLog(options: ModelOptions | undefined, message: string, ...args: any[]): void {
    if (options?.debug) {
      console.log(`[${this.constructor.name}] ${message}`, ...args);
    }
  }

  protected truncateForLogging(obj: any, maxLength?: number): string {
    const defaultMaxLength = 500;
    const configMaxLength = (this.config as Record<string, any>)[
      this.constructor.name.toLowerCase()
    ]?.debugLogMaxLength;
    const effectiveMaxLength = maxLength ?? configMaxLength ?? defaultMaxLength;

    const str = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    if (str.length <= effectiveMaxLength) return str;
    return str.slice(0, effectiveMaxLength) + '... (truncated)';
  }

  abstract supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }>;
  abstract executePrompt(prompt: string, options: ModelOptions): Promise<string>;
}

// Helper function for exponential backoff retry
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 5,
  baseDelay: number = 1000, // 1 second
  shouldRetry: (error: any) => boolean = () => true
): Promise<T> {
  let attempt = 1;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}

// Base class for OpenAI-compatible providers (OpenAI and OpenRouter)
abstract class OpenAIBase extends BaseProvider {
  protected defaultClient: OpenAI;
  protected webSearchClient: OpenAI;

  constructor(
    apiKey: string,
    baseURL?: string,
    options?: { defaultHeaders?: Record<string, string> },
    webSearchOptions?: { baseURL?: string; defaultHeaders?: Record<string, string> }
  ) {
    super();
    this.defaultClient = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      defaultHeaders: options?.defaultHeaders,
    });
    // Use the same client for web search by default
    this.webSearchClient = webSearchOptions
      ? new OpenAI({
          apiKey,
          baseURL: webSearchOptions.baseURL ?? baseURL,
          defaultHeaders: webSearchOptions.defaultHeaders ?? options?.defaultHeaders,
        })
      : this.defaultClient;
  }

  protected getClient(options: ModelOptions): OpenAI {
    if (options.webSearch) {
      return this.webSearchClient;
    }
    return this.defaultClient;
  }

  async supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }> {
    return {
      supported: false,
      error: 'OpenAI does not support web search capabilities',
    };
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    const model = await this.getModel(options);
    const maxTokens = options.maxTokens;
    const systemPrompt = this.getSystemPrompt(options);
    const client = this.getClient(options);
    const startTime = Date.now();

    this.logRequestStart(
      options,
      model,
      maxTokens,
      systemPrompt,
      `${client.baseURL ?? 'https://api.openai.com/v1'}/chat/completions`
    );

    try {
      const messages = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ];

      this.debugLog(options, 'Request messages:', this.truncateForLogging(messages));

      const response = await client.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
      });

      const endTime = Date.now();
      this.debugLog(options, `API call completed in ${endTime - startTime}ms`);
      this.debugLog(options, 'Response:', this.truncateForLogging(response));

      const content = response.choices[0].message.content;
      if (!content) {
        throw new ProviderError(`${this.constructor.name} returned an empty response`);
      }

      return content;
    } catch (error) {
      console.error(`Error in ${this.constructor.name} executePrompt`, error);
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new NetworkError(`Failed to communicate with ${this.constructor.name} API`, error);
    }
  }
}

// Google Vertex AI provider implementation
export class GoogleVertexAIProvider extends BaseProvider {
  constructor() {
    super();
    // Initialize the promise in constructor
    this.availableModels = this.initializeModels();
    this.availableModels.catch((error) => {
      console.error('Error fetching Vertex AI models:', error);
    });
  }

  private async initializeModels(): Promise<Set<string>> {
    try {
      const authClient = await this.getAuthClient();
      const token = await authClient.getAccessToken();

      const response = await fetch(
        'https://us-central1-aiplatform.googleapis.com/v1beta1/publishers/google/models',
        {
          headers: {
            Authorization: `Bearer ${token.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new NetworkError(`Failed to fetch Vertex AI models: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data?.publisherModels) {
        console.warn('Unexpected API response format:', data);
        return new Set();
      }
      return new Set(
        data.publisherModels.map((model: any) => {
          // Extract just the model name without the publishers/google/models/ prefix
          const name = model.name.replace('publishers/google/models/', '');
          return name;
        })
      );
    } catch (error) {
      console.error('Error fetching Vertex AI models:', error);
      throw new NetworkError('Failed to fetch available Vertex AI models', error as Error);
    }
  }

  async supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }> {
    try {
      const availableModels = await this.availableModels;
      if (!availableModels) {
        throw new Error('Models not initialized. Call initializeModels() first.');
      }
      // Extract model name without provider prefix if present
      const modelWithoutPrefix = modelName.includes('/') ? modelName.split('/')[1] : modelName;

      if (!availableModels.has(modelWithoutPrefix)) {
        const similarModels = getSimilarModels(modelWithoutPrefix, availableModels);
        const webSearchModels = similarModels.filter(
          (m) => m.includes('sonar') || m.includes('online') || m.includes('gemini')
        );

        if (webSearchModels.length > 0) {
          return {
            supported: false,
            model: webSearchModels[0],
            error: `Model '${modelName}' not found. Consider using ${webSearchModels[0]} for web search instead.`,
          };
        }

        return {
          supported: false,
          error: `Model '${modelName}' not found.\n\nAvailable web search models:\n${Array.from(
            availableModels
          )
            .filter((m) => m.includes('sonar') || m.includes('online') || m.includes('gemini'))
            .slice(0, 5)
            .map((m) => `- ${m}`)
            .join('\n')}`,
        };
      }

      // Check if the model supports web search
      if (isWebSearchSupportedModelOnModelBox(modelWithoutPrefix)) {
        return { supported: true };
      }

      // Suggest a web search capable model
      const webSearchModels = Array.from(availableModels)
        .filter((m) => m.includes('sonar') || m.includes('online') || m.includes('gemini'))
        .slice(0, 5);

      return {
        supported: false,
        model: webSearchModels[0],
        error: `Model ${modelName} does not support web search. Try one of these models:\n${webSearchModels.map((m) => `- ${m}`).join('\n')}`,
      };
    } catch (error) {
      console.error('Error checking web search support:', error);
      return {
        supported: false,
        error: 'Failed to check web search support. Please try again.',
      };
    }
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {

    // Handle token count if provided
    if (options?.tokenCount) {
      const { model: tokenModel, error } = this.handleLargeTokenCount(options.tokenCount);
      if (error) {
        throw new ProviderError(error);
      }
      if (tokenModel) {
        options = { ...options, model: tokenModel };
      }
    }

    const model = await this.getModel(options);
    
    // Validate model name if we have the list
    const availableModels = await this.availableModels;
    if (!availableModels) {
      throw new Error('Models not initialized. Call initializeModels() first.');
    }
    if (!availableModels.has(model)) {
      const similarModels = getSimilarModels(model, availableModels);
      throw new ModelNotFoundError(
        `Model '${model}' not found in Vertex AI.\n\n` +
          `You requested: ${model}\n` +
          `Similar available models:\n${similarModels.map((m) => `- ${m}`).join('\n')}\n\n` +
          `Use --model with one of the above models.`
      );
    }

    const maxTokens = options.maxTokens;
    const systemPrompt = this.getSystemPrompt(options);
    const startTime = Date.now();

    const projectId = 'prime-elf-451813-c9'; // TODO: Make this configurable
    const location = 'us-central1'; // TODO: Make this configurable
    const baseURL = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    this.logRequestStart(options, model, maxTokens, systemPrompt, baseURL);

    return retryWithBackoff(
      async () => {
        try {
          const requestBody: GoogleVertexAIRequestBody = {
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: { maxOutputTokens: maxTokens },
            ...(systemPrompt
              ? {
                  system_instruction: {
                    parts: [{ text: systemPrompt }],
                  },
                }
              : {}),
          };

          // Add web search tool only when explicitly requested
          if (options?.webSearch) {
            requestBody.tools = [
              {
                google_search: {},
              },
            ];
          }

          this.debugLog(options, 'Request body:', this.truncateForLogging(requestBody));

          const authClient = await this.getAuthClient();
          const token = await authClient.getAccessToken();

          const response = await fetch(baseURL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          const endTime = Date.now();
          this.debugLog(options, `API call completed in ${endTime - startTime}ms`);

          if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 429) {
              console.warn(
                'Received 429 error from Google API. This can occur due to token limits on free accounts. ' +
                  'For more information, see: https://github.com/eastlondoner/cursor-tools/issues/35'
              );
            }
            throw new NetworkError(`Google Vertex AI API error (${response.status}): ${errorText}`);
          }

          const data = await response.json();
          this.debugLog(options, 'Response:', this.truncateForLogging(data));

          const content = data.candidates[0]?.content?.parts[0]?.text;
          const grounding = data.candidates[0]?.groundingMetadata as GeminiGroundingMetadata;
          const webSearchQueries = grounding?.webSearchQueries;

          let webSearchText = '';
          if (webSearchQueries && webSearchQueries.length > 0) {
            webSearchText = '\nWeb search queries:\n';
            for (const query of webSearchQueries) {
              webSearchText += `- ${query}\n`;
            }
            webSearchText += '\n';
          }

          // Format response with citations if grounding metadata exists
          let formattedContent = content;
          if (grounding?.groundingSupports?.length > 0 && grounding?.groundingChunks?.length > 0) {
            const citationSources = new Map<number, { uri: string; title?: string }>();

            // Build citation sources from groundingChunks
            grounding.groundingChunks.forEach((chunk: GeminiGroundingChunk, idx: number) => {
              if (chunk.web) {
                citationSources.set(idx, {
                  uri: chunk.web.uri,
                  title: chunk.web.title,
                });
              }
            });

            // Format text with citations
            let formattedText = '';
            grounding.groundingSupports.forEach((support: GeminiGroundingSupport) => {
              const segment = support.segment;
              const citations = support.groundingChunkIndices
                .map((idx: number) => {
                  const source = citationSources.get(idx);
                  return source ? `[${idx + 1}]` : '';
                })
                .filter(Boolean)
                .join('');

              formattedText += segment.text + (citations ? ` ${citations}` : '') + ' ';
            });

            // Add citations list
            if (citationSources.size > 0) {
              let citationsText = '\nCitations:\n';
              citationSources.forEach((source, idx) => {
                citationsText += `[${idx + 1}]: ${source.uri}${source.title ? ` ${source.title}` : ''}\n`;
              });
              formattedText = citationsText + '\n' + webSearchText + formattedText;
            } else {
              formattedText = webSearchText + formattedText;
            }
            // replace the original content with the formatted text
            formattedContent = formattedText.trim();
          }

          if (!formattedContent) {
            throw new ProviderError('Google Vertex AI returned an empty response');
          }

          return formattedContent;
        } catch (error) {
          if (error instanceof ProviderError) {
            throw error;
          }
          throw new NetworkError('Failed to communicate with Google Vertex AI API', error as Error);
        }
      },
      5,
      1000,
      (error) => {
        if (error instanceof NetworkError) {
          const errorText = error.message.toLowerCase();
          return errorText.includes('429') || errorText.includes('resource exhausted');
        }
        return false;
      }
    );
  }

  protected handleLargeTokenCount(tokenCount: number): { model?: string; error?: string } {

    if (tokenCount > 800_000 && tokenCount < 2_000_000) {
      // 1M is the limit but token counts are very approximate so play it safe
      console.error(
        `Repository content is large (${Math.round(tokenCount / 1000)}K tokens), switching to gemini-2.0-pro-exp model...`
      );
      return { model: 'gemini-2.0-pro-exp-02-05' }; // correct name for vertex ai
    }

    if (tokenCount >= 2_000_000) {
      return {
        error:
          'Repository content is too large for Vertex AI API.\n' +
          'Please try:\n' +
          '1. Using a more specific query to document a particular feature or module\n' +
          '2. Running the documentation command on a specific directory or file\n' +
          '3. Cloning the repository locally and using .gitignore to exclude non-essential files',
      };
    }

    return {};
  }

  private async getAuthClient(): Promise<AuthClient> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ApiKeyMissingError('Google Vertex AI');
    }

    // Check if the value is a path to a JSON key file
    if (apiKey.endsWith('.json')) {
      if (!existsSync(apiKey)) {
        throw new Error(`Google Vertex AI JSON key file not found at: ${apiKey}`);
      }
      console.log(`Using service account JSON key from: ${apiKey}`);
      return new GoogleAuth({
        keyFile: apiKey,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      }).getClient();
    }

    // Check if the value is "adc" to use Application Default Credentials
    if (apiKey.toLowerCase() === 'adc') {
      console.log('Using Application Default Credentials for Google Vertex AI');
      return new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      }).getClient();
    }

    throw new Error(
      'Google Vertex AI requires service account authentication. Please provide a JSON key file or use ADC.'
    );
  }
}

// Google Generative Language provider implementation
export class GoogleGenerativeLanguageProvider extends BaseProvider {
  constructor() {
    super();
    // Initialize the promise in constructor
    this.availableModels = this.initializeModels();
    this.availableModels.catch((error) => {
      console.error('Error fetching Google Generative Language models:', error);
    });
  }

  private async initializeModels(): Promise<Set<string>> {
    try {
      const apiKey = await this.getAPIKey();
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );

      if (!response.ok) {
        throw new NetworkError(`Failed to fetch Gemini models: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data?.models) {
        console.warn('Unexpected API response format:', data);
        return new Set();
      }

      const models = new Set<string>(
        data.models
          .map((model: any) => model.name.replace('models/', ''))
          .filter((name: string) => name.includes('gemini'))
      );

      return models;
    } catch (error) {
      console.error('Error fetching Gemini models:', error);
      throw new NetworkError('Failed to fetch available Gemini models', error as Error);
    }
  }

  private async getAPIKey(): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ApiKeyMissingError('Google Generative Language');
    }

    // If it's a JSON key or ADC, use Vertex AI instead
    if (apiKey.endsWith('.json') || apiKey.toLowerCase() === 'adc') {
      throw new Error(
        'Service account authentication is not supported for Google Generative Language API. Please use an API key.'
      );
    }

    return apiKey;
  }

  async supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }> {
    const unsupportedModels = new Set([
      'gemini-2.0-flash-thinking-exp-01-21',
      'gemini-2.0-flash-thinking-exp',
    ]);
    if (unsupportedModels.has(modelName)) {
      return {
        supported: false,
        model: 'gemini-2.0-pro-exp',
        error: `Model ${modelName} does not support web search.`,
      };
    }

    return {
      supported: true,
    };
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    // Handle token count if provided
    if (options?.tokenCount) {
      const { model: tokenModel, error } = this.handleLargeTokenCount(options.tokenCount);
      if (error) {
        throw new ProviderError(error);
      }
      if (tokenModel) {
        options = { ...options, model: tokenModel };
      }
    }

    const model = await this.getModel(options);
    const maxTokens = options.maxTokens;
    const systemPrompt = this.getSystemPrompt(options);
    const startTime = Date.now();

    const baseURL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    this.logRequestStart(options, model, maxTokens, systemPrompt, baseURL);

    return retryWithBackoff(
      async () => {
        try {
          const requestBody: GoogleGenerativeLanguageRequestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens },
            ...(systemPrompt
              ? {
                  system_instruction: {
                    parts: [{ text: systemPrompt }],
                  },
                }
              : {}),
          };

          // Add web search tool only when explicitly requested
          if (options?.webSearch) {
            requestBody.tools = [
              {
                google_search: {},
              },
            ];
          }

          this.debugLog(options, 'Request body:', this.truncateForLogging(requestBody));

          const apiKey = await this.getAPIKey();
          const url = `${baseURL}?key=${apiKey}`;

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          const endTime = Date.now();
          this.debugLog(options, `API call completed in ${endTime - startTime}ms`);

          if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 429) {
              if(options.debug) {
                console.log('Response:', errorText, response);
              }
              console.warn(
                'Received 429 error from Google API. This can occur due to token limits on free accounts. ' +
                  'For more information, see: https://github.com/eastlondoner/cursor-tools/issues/35'
              );
            }
            throw new NetworkError(
              `Google Generative Language API error (${response.status}): ${errorText}`
            );
          }

          const data = await response.json();
          this.debugLog(options, 'Response:', this.truncateForLogging(data));

          const content = data.candidates[0]?.content?.parts[0]?.text;
          const grounding = data.candidates[0]?.groundingMetadata as GeminiGroundingMetadata;
          const webSearchQueries = grounding?.webSearchQueries;

          let webSearchText = '';
          if (webSearchQueries && webSearchQueries.length > 0) {
            webSearchText = '\nWeb search queries:\n';
            for (const query of webSearchQueries) {
              webSearchText += `- ${query}\n`;
            }
            webSearchText += '\n';
          }

          // Format response with citations if grounding metadata exists
          let formattedContent = content;
          if (grounding?.groundingSupports?.length > 0 && grounding?.groundingChunks?.length > 0) {
            const citationSources = new Map<number, { uri: string; title?: string }>();

            // Build citation sources from groundingChunks
            grounding.groundingChunks.forEach((chunk: GeminiGroundingChunk, idx: number) => {
              if (chunk.web) {
                citationSources.set(idx, {
                  uri: chunk.web.uri,
                  title: chunk.web.title,
                });
              }
            });

            // Format text with citations
            let formattedText = '';
            grounding.groundingSupports.forEach((support: GeminiGroundingSupport) => {
              const segment = support.segment;
              const citations = support.groundingChunkIndices
                .map((idx: number) => {
                  const source = citationSources.get(idx);
                  return source ? `[${idx + 1}]` : '';
                })
                .filter(Boolean)
                .join('');

              formattedText += segment.text + (citations ? ` ${citations}` : '') + ' ';
            });

            // Add citations list
            if (citationSources.size > 0) {
              let citationsText = '\nCitations:\n';
              citationSources.forEach((source, idx) => {
                citationsText += `[${idx + 1}]: ${source.uri}${source.title ? ` ${source.title}` : ''}\n`;
              });
              formattedText = citationsText + '\n' + webSearchText + formattedText;
            } else {
              formattedText = webSearchText + formattedText;
            }
            // replace the original content with the formatted text
            formattedContent = formattedText.trim();
          }

          if (!formattedContent) {
            throw new ProviderError('Google Generative Language returned an empty response');
          }

          return formattedContent;
        } catch (error) {
          if (error instanceof ProviderError) {
            throw error;
          }
          throw new NetworkError(
            'Failed to communicate with Google Generative Language API',
            error as Error
          );
        }
      },
      5,
      1000,
      (error) => {
        if (error instanceof NetworkError) {
          const errorText = error.message.toLowerCase();
          return errorText.includes('429') || errorText.includes('resource exhausted');
        }
        return false;
      }
    );
  }

  protected handleLargeTokenCount(tokenCount: number): { model?: string; error?: string } {

    if (tokenCount > 800_000 && tokenCount < 2_000_000) {
      // 1M is the limit but token counts are very approximate so play it safe
      console.error(
        `Repository content is large (${Math.round(tokenCount / 1000)}K tokens), switching to gemini-2.0-pro-exp model...`
      );
      return { model: 'gemini-2.0-pro-exp' };
    }

    if (tokenCount >= 2_000_000) {
      return {
        error:
          'Repository content is too large for Vertex AI API.\n' +
          'Please try:\n' +
          '1. Using a more specific query to document a particular feature or module\n' +
          '2. Running the documentation command on a specific directory or file\n' +
          '3. Cloning the repository locally and using .gitignore to exclude non-essential files',
      };
    }

    return {};
  }
}

// OpenAI provider implementation
export class OpenAIProvider extends OpenAIBase {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ApiKeyMissingError('OpenAI');
    }
    super(apiKey);
  }

  async supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }> {
    return {
      supported: false,
      error: 'OpenAI does not support web search capabilities',
    };
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    const model = await this.getModel(options);
    const maxTokens = options.maxTokens;
    const systemPrompt = this.getSystemPrompt(options);
    const messageLimit = 1048576; // OpenAI's character limit
    const client = this.getClient(options);
    const promptChunks = chunkMessage(prompt, messageLimit);
    let combinedResponseContent = '';

    for (const chunk of promptChunks) {
      try {
        const messages = [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: chunk },
        ];

        this.debugLog(options, 'Request messages:', this.truncateForLogging(messages));

        const response = await client.chat.completions.create({
          model,
          messages,
          ...(model.startsWith('o')
            ? {
                max_completion_tokens: maxTokens,
              }
            : {
                max_tokens: maxTokens,
              }),
        });

        this.debugLog(options, 'Response:', JSON.stringify(response, null, 2));

        const content = response.choices[0].message.content;
        if (content) {
          combinedResponseContent += content + '\n'; // Append chunk response
        } else {
          console.warn(`${this.constructor.name} returned an empty response chunk.`);
        }
      } catch (error) {
        console.error(`Error in ${this.constructor.name} executePrompt chunk`, error);
        if (error instanceof ProviderError) {
          throw error;
        }
        throw new NetworkError(`Failed to communicate with ${this.constructor.name} API`, error);
      }
    }

    if (!combinedResponseContent.trim()) {
      throw new ProviderError(
        `${this.constructor.name} returned an overall empty response after processing chunks.`
      );
    }
    return combinedResponseContent.trim();
  }
}

// OpenRouter provider implementation
export class OpenRouterProvider extends OpenAIBase {
  private readonly headers: Record<string, string>;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new ApiKeyMissingError('OpenRouter');
    }
    const headers = {
      'HTTP-Referer': 'http://cursor-tools.com',
      'X-Title': 'cursor-tools',
    };
    super(apiKey, 'https://openrouter.ai/api/v1', {
      defaultHeaders: headers,
    });
    this.headers = headers;
    // Initialize the promise in constructor
    this.availableModels = this.initializeModels();
    this.availableModels.catch((error) => {
      console.error('Error fetching OpenRouter models:', error);
    });
  }

  private async initializeModels(): Promise<Set<string>> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          ...this.headers,
        },
      });

      if (!response.ok) {
        throw new NetworkError(`Failed to fetch OpenRouter models: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data?.data) {
        console.warn('Unexpected API response format:', data);
        return new Set();
      }
      // Each model in the response has an 'id' field that we can use
      return new Set(data.data.map((model: any) => model.id));
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      throw new NetworkError('Failed to fetch available OpenRouter models', error);
    }
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    const model = await this.getModel(options);
    const maxTokens = options.maxTokens;
    const systemPrompt = this.getSystemPrompt(options);
    const client = this.getClient(options);

    try {
      const messages = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ];

      this.logRequestStart(
        options,
        model,
        maxTokens,
        systemPrompt,
        `${client.baseURL ?? 'https://openrouter.ai/api/v1'}/chat/completions`,
        this.headers
      );

      const response = await client.chat.completions.create(
        {
          model,
          messages,
          max_tokens: maxTokens,
        },
        {
          timeout: Math.floor(options?.timeout ?? TEN_MINUTES),
          maxRetries: 3,
        }
      );

      this.debugLog(options, 'Response:', JSON.stringify(response, null, 2));

      const content = response.choices[0].message.content;
      if (!content) {
        throw new ProviderError(`${this.constructor.name} returned an empty response`);
      }
      return content;
    } catch (error) {
      console.error('OpenRouter Provider: Error during API call:', error);
      if (error instanceof ProviderError || error instanceof NetworkError) {
        throw error;
      }
      throw new NetworkError(`Failed to communicate with ${this.constructor.name} API`, error);
    }
  }

  async supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }> {
    return {
      supported: false,
      error: 'OpenRouter does not support web search capabilities',
    };
  }
}

// Perplexity provider implementation
export class PerplexityProvider extends BaseProvider {
  async supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }> {
    if (modelName.startsWith('sonar')) {
      return { supported: true };
    }
    return {
      supported: false,
      model: 'sonar-pro',
      error: `Model ${modelName} does not support web search. Use a model with -online suffix instead.`,
    };
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new ApiKeyMissingError('Perplexity');
    }

    return retryWithBackoff(
      async () => {
        const model = await this.getModel(options);
        const maxTokens = options.maxTokens;
        const systemPrompt = this.getSystemPrompt(options);
        const startTime = Date.now();

        this.logRequestStart(
          options,
          model,
          maxTokens,
          systemPrompt,
          'https://api.perplexity.ai/chat/completions'
        );

        try {
          const requestBody = {
            model,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: prompt },
            ],
            max_tokens: maxTokens,
          };

          this.debugLog(options, 'Request body:', this.truncateForLogging(requestBody));

          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          const endTime = Date.now();
          this.debugLog(options, `API call completed in ${endTime - startTime}ms`);

          if (!response.ok) {
            const errorText = await response.text();
            throw new NetworkError(`Perplexity API error: ${errorText}`);
          }

          const data = await response.json();
          this.debugLog(options, 'Response:', this.truncateForLogging(data));

          const content = data.choices[0]?.message?.content;

          if (!content) {
            throw new ProviderError('Perplexity returned an empty response');
          }

          return content;
        } catch (error) {
          if (error instanceof ProviderError || error instanceof NetworkError) {
            throw error;
          }
          throw new NetworkError('Failed to communicate with Perplexity API', error);
        }
      },
      5,
      1000,
      (error) => {
        if (error instanceof NetworkError) {
          const errorText = error.message.toLowerCase();
          return errorText.includes('429') || errorText.includes('rate limit');
        }
        return false;
      }
    );
  }
}

// ModelBox provider implementation
export class ModelBoxProvider extends OpenAIBase {
  private static readonly defaultHeaders: Record<string, string> = {};
  private static readonly webSearchHeaders: Record<string, string> = {
    'x-feature-search-internet': 'true',
  };

  constructor() {
    const apiKey = process.env.MODELBOX_API_KEY;
    if (!apiKey) {
      throw new ApiKeyMissingError('ModelBox');
    }
    super(
      apiKey,
      'https://api.model.box/v1',
      {
        defaultHeaders: ModelBoxProvider.defaultHeaders,
      },
      {
        defaultHeaders: ModelBoxProvider.webSearchHeaders,
      }
    );
    // Initialize the promise in constructor
    this.availableModels = this.initializeModels();
    this.availableModels.catch((error) => {
      console.error('Error fetching ModelBox models:', error);
    });
  }

  private async initializeModels(): Promise<Set<string>> {
    try {
      const response = await fetch('https://api.model.box/v1/models', {
        headers: {
          Authorization: `Bearer ${process.env.MODELBOX_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new NetworkError(`Failed to fetch ModelBox models: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data?.data) {
        console.warn('Unexpected API response format:', data);
        return new Set();
      }
      // Keep the full model ID including provider prefix
      return new Set(data.data.map((model: any) => model.id));
    } catch (error) {
      console.error('Error fetching ModelBox models:', error);
      throw new NetworkError('Failed to fetch available ModelBox models', error);
    }
  }

  async supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }> {
    try {
      const availableModels = await this.availableModels;
      if (!availableModels) {
        throw new Error('Models not initialized. Call initializeModels() first.');
      }

      // Try to find the model with or without prefix
      const modelWithoutPrefix = modelName.includes('/') ? modelName.split('/')[1] : modelName;
      const matchingModels = Array.from(availableModels).filter(
        (m) =>
          m === modelName || // Exact match with prefix
          m === `openai/${modelName}` || // Try with openai prefix
          m.endsWith(`/${modelWithoutPrefix}`) || // Match with any prefix
          m === modelWithoutPrefix // Exact match without prefix
      );

      if (matchingModels.length === 0) {
        // Find similar models by comparing against both prefixed and unprefixed versions
        const similarModels = Array.from(availableModels)
          .filter((m) => {
            const mWithoutPrefix = m.includes('/') ? m.split('/')[1] : m;
            return stringSimilarity(modelWithoutPrefix, mWithoutPrefix) > 0.5;
          })
          .sort((a, b) => {
            const aWithoutPrefix = a.includes('/') ? a.split('/')[1] : a;
            const bWithoutPrefix = b.includes('/') ? b.split('/')[1] : b;
            return (
              stringSimilarity(modelWithoutPrefix, bWithoutPrefix) -
              stringSimilarity(modelWithoutPrefix, aWithoutPrefix)
            );
          });

        const webSearchModels = similarModels.filter(
          (m) => m.includes('sonar') || m.includes('online') || m.includes('gemini')
        );

        if (webSearchModels.length > 0) {
          return {
            supported: false,
            model: webSearchModels[0],
            error: `Model '${modelName}' not found. Consider using ${webSearchModels[0]} for web search instead.\nNote: ModelBox requires provider prefixes (e.g., 'openai/gpt-4' instead of just 'gpt-4').`,
          };
        }

        return {
          supported: false,
          error: `Model '${modelName}' not found.\n\nAvailable web search models:\n${Array.from(
            availableModels
          )
            .filter((m) => m.includes('sonar') || m.includes('online') || m.includes('gemini'))
            .slice(0, 5)
            .map((m) => `- ${m}`)
            .join(
              '\n'
            )}\n\nNote: ModelBox requires provider prefixes (e.g., 'openai/gpt-4' instead of just 'gpt-4').`,
        };
      }

      // Use the first matching model (prioritizing exact matches)
      const resolvedModel = matchingModels[0];

      // Check if the model supports web search
      if (isWebSearchSupportedModelOnModelBox(resolvedModel)) {
        return { supported: true };
      }

      // Suggest a web search capable model
      const webSearchModels = Array.from(availableModels)
        .filter((m) => m.includes('sonar') || m.includes('online') || m.includes('gemini'))
        .slice(0, 5);

      return {
        supported: false,
        model: webSearchModels[0],
        error: `Model ${resolvedModel} does not support web search. Try one of these models:\n${webSearchModels.map((m) => `- ${m}`).join('\n')}`,
      };
    } catch (error) {
      console.error('Error checking web search support:', error);
      return {
        supported: false,
        error: 'Failed to check web search support. Please try again.',
      };
    }
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    const model = await this.getModel(options);
    const maxTokens = options.maxTokens;
    const systemPrompt = this.getSystemPrompt(options);
    const client = this.getClient(options);

    try {
      const messages = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ];

      this.logRequestStart(
        options,
        model,
        maxTokens,
        systemPrompt,
        `${client.baseURL ?? 'https://api.model.box/v1'}/chat/completions`,
        options.webSearch ? ModelBoxProvider.webSearchHeaders : ModelBoxProvider.defaultHeaders
      );

      const response = await client.chat.completions.create(
        {
          model,
          messages,
          max_tokens: maxTokens,
        },
        {
          timeout: Math.floor(options?.timeout ?? TEN_MINUTES),
          maxRetries: 3,
        }
      );

      this.debugLog(options, 'Response:', JSON.stringify(response, null, 2));

      const content = response.choices[0].message.content;
      if (!content) {
        throw new ProviderError(`${this.constructor.name} returned an empty response`);
      }
      return content;
    } catch (error) {
      console.error('ModelBox Provider: Error during API call:', error);
      if (error instanceof ProviderError || error instanceof NetworkError) {
        throw error;
      }
      throw new NetworkError(`Failed to communicate with ${this.constructor.name} API`, error);
    }
  }
}

// Anthropic provider implementation
export class AnthropicProvider extends BaseProvider {
  private client: Anthropic;

  constructor() {
    super();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ApiKeyMissingError('Anthropic');
    }
    this.client = new Anthropic({
      apiKey,
    });
  }

  async supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }> {
    return {
      supported: false,
      error: 'Anthropic does not support web search capabilities',
    };
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    const model = await this.getModel(options);
    const maxTokens = options.maxTokens;
    const systemPrompt = this.getSystemPrompt(options);
    const startTime = Date.now();

    this.logRequestStart(
      options,
      model,
      maxTokens,
      systemPrompt,
      'https://api.anthropic.com/v1/messages'
    );

    try {
      const requestBody = {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user' as const, content: prompt }],
      };

      this.debugLog(options, 'Request body:', this.truncateForLogging(requestBody));

      const response = await this.client.messages.create(requestBody);

      const endTime = Date.now();
      this.debugLog(options, `API call completed in ${endTime - startTime}ms`);
      this.debugLog(options, 'Response:', this.truncateForLogging(response));

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new ProviderError('Anthropic returned an invalid response');
      }

      return content.text;
    } catch (error) {
      console.error('Anthropic Provider: Error during API call:', error);
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new NetworkError('Failed to communicate with Anthropic API', error);
    }
  }
}

// Factory function to create providers
export function createProvider(
  provider: 'gemini' | 'openai' | 'openrouter' | 'perplexity' | 'modelbox' | 'anthropic'
): BaseModelProvider {
  switch (provider) {
    case 'gemini': {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new ApiKeyMissingError('Gemini');
      }

      // Choose between Vertex AI and Generative Language based on credentials
      if (apiKey.endsWith('.json') || apiKey.toLowerCase() === 'adc') {
        console.log('Using Google Vertex AI provider');
        const vertexProvider = new GoogleVertexAIProvider();
        return vertexProvider;
      } else {
        console.log('Using Google Generative Language provider');
        return new GoogleGenerativeLanguageProvider();
      }
    }
    case 'openai':
      return new OpenAIProvider();
    case 'openrouter':
      return new OpenRouterProvider();
    case 'perplexity':
      return new PerplexityProvider();
    case 'modelbox': {
      const provider = new ModelBoxProvider();

      return provider;
    }
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw exhaustiveMatchGuard(provider);
  }
}

function isWebSearchSupportedModelOnModelBox(model: string): boolean {
  // Extract model name without provider prefix if present
  const modelWithoutPrefix = model.includes('/') ? model.split('/')[1] : model;
  return (
    modelWithoutPrefix.includes('sonar') ||
    modelWithoutPrefix.includes('online') ||
    modelWithoutPrefix.includes('gemini')
  );
}
