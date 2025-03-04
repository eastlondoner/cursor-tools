import type { Config } from '../types';
import { loadConfig, loadEnv } from '../config';
import OpenAI from 'openai';
import { ApiKeyMissingError, ModelNotFoundError, NetworkError, ProviderError } from '../errors';
import { exhaustiveMatchGuard } from '../utils/exhaustiveMatchGuard';
import { chunkMessage } from '../utils/messageChunker';
import Anthropic from '@anthropic-ai/sdk';
import { stringSimilarity } from '../utils/stringSimilarity';

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
  supportsWebSearch(model: string): { supported: boolean; model?: string; error?: string };
}

// Base provider class with common functionality
export abstract class BaseProvider implements BaseModelProvider {
  protected config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  protected getModel(options: ModelOptions | undefined): string {
    if (!options?.model) {
      throw new ModelNotFoundError(this.constructor.name.replace('Provider', ''));
    }
    return options.model;
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
    // User prompts is logged elsewhere and it is long so skip it here
    // this.debugLog(options, 'User prompt:', this.truncateForLogging(prompt));
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

  abstract supportsWebSearch(model: string): { supported: boolean; model?: string; error?: string };
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

// Gemini provider implementation
export class GeminiProvider extends BaseProvider {
  private readonly maxRecitationRetries = 2;

  protected handleLargeTokenCount(tokenCount: number): { model?: string; error?: string } {
    if (tokenCount > 800_000 && tokenCount < 2_000_000) {
      // 1M is the limit but token counts are very approximate so play it save
      console.error(
        `Repository content is large (${Math.round(tokenCount / 1000)}K tokens), switching to gemini-2.0-pro-exp model...`
      );
      return { model: 'gemini-2.0-pro-exp' };
    }

    if (tokenCount >= 2_000_000) {
      return {
        error:
          'Repository content is too large for Gemini API.\n' +
          'Please try:\n' +
          '1. Using a more specific query to document a particular feature or module\n' +
          '2. Running the documentation command on a specific directory or file\n' +
          '3. Cloning the repository locally and using .gitignore to exclude non-essential files',
      };
    }

    return {};
  }

  supportsWebSearch(model: string): { supported: boolean; model?: string; error?: string } {
    const unsupportedModels = new Set([
      'gemini-2.0-flash-thinking-exp-01-21',
      'gemini-2.0-flash-thinking-exp',
    ]);
    if (unsupportedModels.has(model)) {
      return {
        supported: false,
        model: 'gemini-2.0-pro-exp',
        error: `Model ${model} does not support web search.`,
      };
    }

    return {
      supported: true,
    };
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ApiKeyMissingError('Gemini');
    }

    let attempt = 0;
    return retryWithBackoff(
      async () => {
        attempt++;
        // Handle token count if provided
        let finalOptions = { ...options };
        if (options?.tokenCount) {
          const { model: tokenModel, error } = this.handleLargeTokenCount(options.tokenCount);
          if (error) {
            throw new ProviderError(error);
          }
          if (tokenModel) {
            finalOptions = { ...finalOptions, model: tokenModel ?? options.model };
          }
        }

        const model = this.getModel(finalOptions);
        const maxTokens = finalOptions.maxTokens;
        const systemPrompt = this.getSystemPrompt(options);
        const startTime = Date.now();

        this.logRequestStart(
          options,
          model,
          maxTokens,
          systemPrompt,
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
        );

        if (attempt > 1) {
          prompt = 'Something went wrong, try again:\n' + prompt;
        }

        try {
          const requestBody: any = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens },
            system_instruction: {
              parts: [
                {
                  text: systemPrompt,
                },
              ],
            },
          };

          // Add web search tool only when explicitly requested
          if (options?.webSearch) {
            requestBody.tools = [
              // this is how it is documented on google but it doesn't work
              // {
              //   google_search_retrieval: {
              //     "dynamic_retrieval_config": {
              //       mode: 'MODE_DYNAMIC',
              //       dynamic_threshold: 0, // always use grounding
              //     },
              //   },
              // },
              // this is undocumented but works
              {
                google_search: {},
              },
            ];
          }

          this.debugLog(options, 'Request body:', this.truncateForLogging(requestBody));

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            }
          );

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
            throw new NetworkError(`Gemini API HTTP error (${response.status}): ${errorText}`);
          }

          const data = await response.json();
          if (data.error) {
            throw new ProviderError(`Gemini API error: ${JSON.stringify(data.error)}`);
          }

          this.debugLog(options, 'Response:', this.truncateForLogging(data));

          const content = data.candidates[0]?.content?.parts
            .map((part: any) => part.text)
            .filter(Boolean)
            .join('\n');

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
            throw new ProviderError('Gemini returned an empty response');
          }

          return formattedContent;
        } catch (error) {
          if (error instanceof ProviderError) {
            throw error;
          }
          throw new NetworkError('Failed to communicate with Gemini API', error);
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

  supportsWebSearch(model: string): { supported: boolean; model?: string; error?: string } {
    return {
      supported: false,
      error: 'OpenAI does not support web search capabilities',
    };
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    const model = this.getModel(options);
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

// OpenAI provider implementation
export class OpenAIProvider extends OpenAIBase {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ApiKeyMissingError('OpenAI');
    }
    super(apiKey);
  }

  supportsWebSearch(model: string): { supported: boolean; model?: string; error?: string } {
    return {
      supported: false,
      error: 'OpenAI does not support web search capabilities',
    };
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    const model = this.getModel(options);
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
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    const model = this.getModel(options);
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

  supportsWebSearch(model: string): { supported: boolean; model?: string; error?: string } {
    return {
      supported: false,
      error: 'OpenRouter does not support web search capabilities',
    };
  }
}

// Perplexity provider implementation
export class PerplexityProvider extends BaseProvider {
  supportsWebSearch(model: string): { supported: boolean; model?: string; error?: string } {
    if (model.startsWith('sonar')) {
      return { supported: true };
    }
    return {
      supported: false,
      model: 'sonar-pro',
      error: `Model ${model} does not support web search. Use a model with -online suffix instead.`,
    };
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new ApiKeyMissingError('Perplexity');
    }

    return retryWithBackoff(
      async () => {
        const model = this.getModel(options);
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
  private availableModels: Set<string> | null = null;

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
  }

  public async fetchAvailableModels(): Promise<Set<string>> {
    if (this.availableModels) {
      return this.availableModels;
    }

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
      this.availableModels = new Set(data.data.map((model: any) => model.id));
      return this.availableModels;
    } catch (error) {
      console.error('Error fetching ModelBox models:', error);
      throw new NetworkError('Failed to fetch available ModelBox models', error);
    }
  }

  supportsWebSearch(model: string): { supported: boolean; model?: string; error?: string } {
    try {
      const availableModels = this.availableModels;

      if (availableModels) {
        // First check if the model exists
        if (!availableModels.has(model)) {
          const similarModels = getProviderSimilarModels(model, availableModels);
          const webSearchModels = similarModels.filter(
            (m) => m.includes('sonar') || m.includes('online') || m.includes('gemini')
          );

          if (webSearchModels.length > 0) {
            return {
              supported: false,
              model: webSearchModels[0],
              error: `Model '${model}' not found. Consider using ${webSearchModels[0]} for web search instead.`,
            };
          }

          return {
            supported: false,
            error: `Model '${model}' not found.\n\nAvailable web search models:\n${Array.from(
              availableModels
            )
              .filter((m) => m.includes('sonar') || m.includes('online') || m.includes('gemini'))
              .slice(0, 5)
              .map((m) => `- ${m}`)
              .join('\n')}`,
          };
        }

        // Check if the model supports web search
        if (isWebSearchSupportedModelOnModelBox(model)) {
          return { supported: true };
        }

        // Suggest a web search capable model
        const webSearchModels = Array.from(availableModels)
          .filter((m) => m.includes('sonar') || m.includes('online') || m.includes('gemini'))
          .slice(0, 5);

        return {
          supported: false,
          model: webSearchModels[0],
          error: `Model ${model} does not support web search. Try one of these models:\n${webSearchModels.map((m) => `- ${m}`).join('\n')}`,
        };
      }

      // If we don't have the model list yet, just check if it's a web search model by name
      return {
        supported: isWebSearchSupportedModelOnModelBox(model),
        error: 'Failed to check web search support. Please try again.',
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
    const model = this.getModel(options);
    const maxTokens = options.maxTokens;
    const systemPrompt = this.getSystemPrompt(options);
    const client = this.getClient(options);

    try {
      // Check if model exists
      const availableModels = await this.fetchAvailableModels();
      if (!availableModels.has(model)) {
        const similarModels = getProviderSimilarModels(model, availableModels);
        throw new ModelNotFoundError(
          `Model '${model}' not found in ModelBox.\n\n` +
            `You requested: ${model}\n` +
            `Similar available models:\n${similarModels.map((m) => `- ${m}`).join('\n')}\n\n` +
            `Use --model with one of the above models.`
        );
      }

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

function isWebSearchSupportedModelOnModelBox(model: string): boolean {
  return model.includes('sonar') || model.includes('online') || model.includes('gemini');
}

/**
 * Find similar models from a list of available models within the same provider namespace
 * 1. Filters models to only those from the same provider (e.g., 'openai/', 'anthropic/')
 * 2. Uses string similarity to find similar model names within that provider
 *
 * @deprecated Consider using the generic implementation in src/utils/stringSimilarity.ts
 * This version is kept for backward compatibility and its provider-specific filtering
 */
function getProviderSimilarModels(model: string, availableModels: Set<string>): string[] {
  const modelParts = model.split('/');
  const [provider, modelName] = modelParts.length > 1 ? modelParts : [null, modelParts[0]];

  // Find models from the same provider or all models if no provider specified
  const similarModels = Array.from(availableModels).filter((m) => {
    if (!provider) return true;
    const [mProvider] = m.split('/');
    return mProvider === provider;
  });

  // Sort by similarity to the requested model name
  return similarModels
    .sort((a, b) => {
      const [, aName = a] = a.split('/'); // Use full string if no provider prefix
      const [, bName = b] = b.split('/');
      const aSimilarity = stringSimilarity(modelName, aName);
      const bSimilarity = stringSimilarity(modelName, bName);
      return bSimilarity - aSimilarity;
    })
    .slice(0, 5); // Return top 5 most similar models
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

  supportsWebSearch(model: string): { supported: boolean; model?: string; error?: string } {
    return {
      supported: false,
      error: 'Anthropic does not support web search capabilities',
    };
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    const model = this.getModel(options);
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
    case 'gemini':
      return new GeminiProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'openrouter':
      return new OpenRouterProvider();
    case 'perplexity':
      return new PerplexityProvider();
    case 'modelbox': {
      const provider = new ModelBoxProvider();
      // background init task
      provider.fetchAvailableModels().catch((error) => {
        console.error('Error fetching ModelBox models:', error);
      });
      return provider;
    }
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw exhaustiveMatchGuard(provider);
  }
}
