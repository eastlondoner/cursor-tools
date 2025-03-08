import type { Config } from '../types';
import { loadConfig, loadEnv } from '../config';
import OpenAI from 'openai';
import {
  ApiKeyMissingError,
  ModelNotFoundError,
  NetworkError,
  ProviderError,
  GeminiRecitationError,
} from '../errors';
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

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  protected async getModel(options: ModelOptions | undefined): Promise<string> {
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
    prompt: string,
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
      `${client.baseURL ?? 'https://api.openai.com/v1'}/chat/completions`,
      prompt
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

interface GoogleGenerativeLanguageRequestBody {
  contents: { parts: { text: string }[] }[];
  generationConfig: { maxOutputTokens: number };
  system_instruction?: { parts: { text: string }[] };
  tools?: { google_search: Record<string, never> }[];
}

// Google Vertex AI provider implementation
export class GoogleVertexAIProvider extends BaseProvider {
  private availableModels: Promise<Set<string>>;

  constructor() {
    super();
    // Initialize the promise in constructor
    this.availableModels = this.initializeModels();
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
        data.publisherModels
          .map((model: any) => {
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

  public async fetchAvailableModels(): Promise<Set<string>> {
    return this.availableModels;
  }

  async supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }> {
    try {
      const availableModels = await this.availableModels;
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
    const model = await this.getModel(options);

    // Validate model name if we have the list
    const availableModels = await this.availableModels;
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

    this.logRequestStart(options, model, maxTokens, systemPrompt, baseURL, prompt);

    try {
      const requestBody = {
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
        throw new NetworkError(`Google Vertex AI API error (${response.status}): ${errorText}`);
          }

          const data = await response.json();
          this.debugLog(options, 'Response:', this.truncateForLogging(data));

      const content = data.candidates[0]?.content?.parts[0]?.text;
      if (!content) {
        throw new ProviderError('Google Vertex AI returned an empty response');
      }

      return content;
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new NetworkError('Failed to communicate with Google Vertex AI API', error as Error);
    }
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

  protected async getModel(options: ModelOptions | undefined): Promise<string> {
    if (!options?.model) {
      throw new ModelNotFoundError(this.constructor.name.replace('Provider', ''));
    }
    let model = options.model;
    const availableModels = await this.availableModels;

    // First try exact match
    if (availableModels.has(model)) {
      return model;
    }

    // Try prefix matching - sort in descending order and take the last one
    const prefixMatches = Array.from(availableModels)
      .filter((m) => m.startsWith(model))
      .sort((a, b) => b.localeCompare(a));

    if (prefixMatches.length > 0) {
      const resolvedModel = prefixMatches[prefixMatches.length - 1];
      console.log(
        `[${this.constructor.name}] Model '${model}' not found. Using prefix match '${resolvedModel}'.`
      );
      return resolvedModel;
    }

    // Try removing -latest suffix
    if (model.endsWith('-latest')) {
      const modelWithoutLatest = model.slice(0, -'-latest'.length);
      const latestMatches = Array.from(availableModels)
        .filter((m) => m.startsWith(modelWithoutLatest))
        .sort((a, b) => b.localeCompare(a));

      if (latestMatches.length > 0) {
        const resolvedModel = latestMatches[latestMatches.length - 1];
        console.log(
          `[${this.constructor.name}] Model '${model}' not found. Using latest match '${resolvedModel}'.`
        );
        return resolvedModel;
      }
    }

    // Try removing -exp- and everything after it
    if (model.includes('-exp-')) {
      const modelWithoutExp = model.split('-exp-')[0];
      const expMatches = Array.from(availableModels)
        .filter((m) => m.startsWith(modelWithoutExp))
        .sort((a, b) => b.localeCompare(a));

      if (expMatches.length > 0) {
        const resolvedModel = expMatches[expMatches.length - 1];
        console.log(
          `[${this.constructor.name}] Model '${model}' not found. Using non-exp match '${resolvedModel}'.`
        );
        return resolvedModel;
      }
    }

    // If all resolution attempts fail, throw error with similar models
    const similarModels = getSimilarModels(model, availableModels);
    throw new ModelNotFoundError(
      `Model '${model}' not found in Vertex AI.\n\n` +
        `You requested: ${model}\n` +
        `Similar available models:\n${similarModels.map((m) => `- ${m}`).join('\n')}\n\n` +
        `Use --model with one of the above models.`
    );
  }
}

// Google Generative Language provider implementation
export class GoogleGenerativeLanguageProvider extends BaseProvider {
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

    // Use API key
    console.log('Using API key for Google Generative Language');
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
    const model = await this.getModel(options);
    const maxTokens = options.maxTokens;
    const systemPrompt = this.getSystemPrompt(options);
    const startTime = Date.now();

    const baseURL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    this.logRequestStart(options, model, maxTokens, systemPrompt, baseURL, prompt);

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
        throw new NetworkError(
          `Google Generative Language API error (${response.status}): ${errorText}`
        );
      }

      const data = await response.json();
      this.debugLog(options, 'Response:', this.truncateForLogging(data));

      const content = data.candidates[0]?.content?.parts[0]?.text;
      if (!content) {
        throw new ProviderError('Google Generative Language returned an empty response');
      }

      return content;
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new NetworkError(
        'Failed to communicate with Google Generative Language API',
        error as Error
      );
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
        prompt,
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
          'https://api.perplexity.ai/chat/completions',
          prompt
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
  private availableModels: Promise<Set<string>>;

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

  public async fetchAvailableModels(): Promise<Set<string>> {
    return this.availableModels;
  }

  async supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }> {
    try {
      const availableModels = await this.availableModels;
      
      // Try to find the model with or without prefix
      const modelWithoutPrefix = modelName.includes('/') ? modelName.split('/')[1] : modelName;
      const matchingModels = Array.from(availableModels).filter(m => 
        m === modelName || // Exact match with prefix
        m === `openai/${modelName}` || // Try with openai prefix
        m.endsWith(`/${modelWithoutPrefix}`) || // Match with any prefix
        m === modelWithoutPrefix // Exact match without prefix
      );

      if (matchingModels.length === 0) {
        // Find similar models by comparing against both prefixed and unprefixed versions
        const similarModels = Array.from(availableModels).filter(m => {
          const mWithoutPrefix = m.includes('/') ? m.split('/')[1] : m;
          return stringSimilarity(modelWithoutPrefix, mWithoutPrefix) > 0.5;
        }).sort((a, b) => {
          const aWithoutPrefix = a.includes('/') ? a.split('/')[1] : a;
          const bWithoutPrefix = b.includes('/') ? b.split('/')[1] : b;
          return stringSimilarity(modelWithoutPrefix, bWithoutPrefix) - stringSimilarity(modelWithoutPrefix, aWithoutPrefix);
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
            .join('\n')}\n\nNote: ModelBox requires provider prefixes (e.g., 'openai/gpt-4' instead of just 'gpt-4').`,
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
      // Check if model exists
      const availableModels = await this.availableModels;
      
      // Try to find the model with or without prefix
      const modelWithoutPrefix = model.includes('/') ? model.split('/')[1] : model;
      const matchingModels = Array.from(availableModels).filter(m => 
        m === model || // Exact match with prefix
        m === `openai/${model}` || // Try with openai prefix
        m.endsWith(`/${modelWithoutPrefix}`) || // Match with any prefix
        m === modelWithoutPrefix // Exact match without prefix
      );

      if (matchingModels.length === 0) {
        // Find similar models by comparing against both prefixed and unprefixed versions
        const similarModels = Array.from(availableModels).filter(m => {
          const mWithoutPrefix = m.includes('/') ? m.split('/')[1] : m;
          return stringSimilarity(modelWithoutPrefix, mWithoutPrefix) > 0.5;
        }).sort((a, b) => {
          const aWithoutPrefix = a.includes('/') ? a.split('/')[1] : a;
          const bWithoutPrefix = b.includes('/') ? b.split('/')[1] : b;
          return stringSimilarity(modelWithoutPrefix, bWithoutPrefix) - stringSimilarity(modelWithoutPrefix, aWithoutPrefix);
        });

        throw new ModelNotFoundError(
          `Model '${model}' not found in ModelBox.\n\n` +
            `You requested: ${model}\n` +
            `Similar available models:\n${similarModels.slice(0, 5).map((m) => `- ${m}`).join('\n')}\n\n` +
            `Use --model with one of the above models. Note: ModelBox requires provider prefixes (e.g., 'openai/gpt-4' instead of just 'gpt-4').`
        );
      }

      // Use the first matching model (prioritizing exact matches)
      const resolvedModel = matchingModels[0];

      const messages = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ];

      this.logRequestStart(
        options,
        resolvedModel,
        maxTokens,
        systemPrompt,
        `${client.baseURL ?? 'https://api.model.box/v1'}/chat/completions`,
        prompt,
        options.webSearch ? ModelBoxProvider.webSearchHeaders : ModelBoxProvider.defaultHeaders
      );

      const response = await client.chat.completions.create(
        {
          model: resolvedModel,
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
      'https://api.anthropic.com/v1/messages',
      prompt
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
        // background init task
        vertexProvider.fetchAvailableModels().catch((error) => {
          console.error('Error fetching Vertex AI models:', error);
        });
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

function isWebSearchSupportedModelOnModelBox(model: string): boolean {
  // Extract model name without provider prefix if present
  const modelWithoutPrefix = model.includes('/') ? model.split('/')[1] : model;
  return modelWithoutPrefix.includes('sonar') || modelWithoutPrefix.includes('online') || modelWithoutPrefix.includes('gemini');
}
