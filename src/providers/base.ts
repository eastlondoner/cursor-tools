import type { Config } from '../config';
import { loadConfig, loadEnv } from '../config';
import OpenAI from 'openai';
import { ApiKeyMissingError, ModelNotFoundError, NetworkError, ProviderError } from '../errors';

// Common options for all providers
export interface ModelOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  tokenCount?: number; // For handling large token counts
}

// Provider configuration in Config
export interface ProviderConfig {
  model?: string;
  maxTokens?: number;
  apiKey?: string;
  // OpenRouter-specific fields
  referer?: string;
  appName?: string;
}

// Base provider interface that all specific provider interfaces will extend
export interface BaseModelProvider {
  executePrompt(prompt: string, options?: ModelOptions): Promise<string>;
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

  protected getMaxTokens(options: ModelOptions | undefined): number {
    return options?.maxTokens || 4000; // Default to 4000 if not specified
  }

  protected abstract getSystemPrompt(options?: ModelOptions): string | undefined;

  protected handleLargeTokenCount(tokenCount: number): { model?: string; error?: string } {
    return {}; // Default implementation - no token count handling
  }

  abstract executePrompt(prompt: string, options?: ModelOptions): Promise<string>;
}

// Gemini provider implementation
export class GeminiProvider extends BaseProvider {
  protected getSystemPrompt(): string | undefined {
    return undefined; // Gemini doesn't use system prompts
  }

  protected handleLargeTokenCount(tokenCount: number): { model?: string; error?: string } {
    if (tokenCount > 800_000 && tokenCount < 2_000_000) {
      console.error(
        `Repository content is large (${Math.round(tokenCount / 1000)}K tokens), switching to gemini-2.0-pro-exp-02-05 model...`
      );
      return { model: 'gemini-2.0-pro-exp-02-05' };
    }
    
    if (tokenCount >= 2_000_000) {
      return {
        error: 'Repository content is too large for Gemini API.\n' +
          'Please try:\n' +
          '1. Using a more specific query to document a particular feature or module\n' +
          '2. Running the documentation command on a specific directory or file\n' +
          '3. Cloning the repository locally and using .gitignore to exclude non-essential files'
      };
    }
    
    return {};
  }

  async executePrompt(prompt: string, options?: ModelOptions): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ApiKeyMissingError('Gemini');
    }

    // Handle token count if provided
    let finalOptions = { ...options };
    if (options?.tokenCount) {
      const { model: tokenModel, error } = this.handleLargeTokenCount(options.tokenCount);
      if (error) {
        throw new ProviderError(error);
      }
      if (tokenModel) {
        finalOptions = { ...finalOptions, model: tokenModel };
      }
    }

    const model = this.getModel(finalOptions);
    const maxTokens = this.getMaxTokens(finalOptions);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        }
      );

      if (!response.ok) {
        throw new NetworkError(`Gemini API error: ${await response.text()}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new ProviderError(`Gemini API error: ${JSON.stringify(data.error)}`);
      }

      const content = data.candidates[0]?.content?.parts[0]?.text;
      if (!content) {
        throw new ProviderError('Gemini returned an empty response');
      }

      return content;
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new NetworkError('Failed to communicate with Gemini API', error);
    }
  }
}

// Base class for OpenAI-compatible providers (OpenAI and OpenRouter)
abstract class OpenAIBase extends BaseProvider {
  protected client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    super();
    this.client = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {})
    });
  }

  protected getSystemPrompt(options?: ModelOptions): string | undefined {
    return options?.systemPrompt || 'You are a helpful assistant. Provide clear and concise responses.';
  }

  async executePrompt(prompt: string, options?: ModelOptions): Promise<string> {
    const model = this.getModel(options);
    const maxTokens = this.getMaxTokens(options);
    const systemPrompt = this.getSystemPrompt(options);

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt }
        ],
        max_tokens: maxTokens,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new ProviderError(`${this.constructor.name} returned an empty response`);
      }

      return content;
    } catch (error) {
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
}

// OpenRouter provider implementation
export class OpenRouterProvider extends OpenAIBase {
  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new ApiKeyMissingError('OpenRouter');
    }
    super(apiKey, 'https://openrouter.ai/api/v1');
  }
}

// Factory function to create providers
export function createProvider(provider: 'gemini' | 'openai' | 'openrouter'): BaseModelProvider {
  switch (provider) {
    case 'gemini':
      return new GeminiProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'openrouter':
      return new OpenRouterProvider();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
} 