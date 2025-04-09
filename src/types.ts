import * as z from 'zod';

export type CommandGenerator = AsyncGenerator<string, void, unknown>;

export type Provider =
  | 'gemini'
  | 'openai'
  | 'openrouter'
  | 'perplexity'
  | 'modelbox'
  | 'anthropic'
  | 'xai';

// Zod schema for reasoning effort
export const reasoningEffortSchema = z.enum(['low', 'medium', 'high']);
export type ReasoningEffort = z.infer<typeof reasoningEffortSchema>;

// Base options shared by all commands
export interface CommandOptions {
  // Core options
  model?: string;
  maxTokens?: number;
  provider?: Provider;
  debug: boolean;
  url?: string;
  json?: boolean | string; // Output results as JSON or provide JSON configuration

  // OpenAI and OpenRouter reasoning options
  reasoningEffort?: ReasoningEffort; // Support for OpenAI o1 and o3-mini reasoning effort

  // Output options
  saveTo?: string; // Path to save output to in addition to stdout
  quiet?: boolean; // Suppress stdout output (only useful with saveTo)

  // Context options
  hint?: string; // Additional context or hint for the AI
  subdir?: string; // Subdirectory to analyze (for repo command)
  withDoc?: string; // URL of a page containing additional context information to use
  fromGithub?: string; // GitHub repository to analyze (for repo and doc commands)

  // Plan command specific options
  fileProvider?: Provider;
  thinkingProvider?: Provider;
  fileModel?: string;
  thinkingModel?: string;

  // Properties merged from RepoCommandOptions and DocCommandOptions
  tokenCount?: number; // For handling large token counts (passed down)
  webSearch?: boolean; // Whether web search is enabled (passed down)
  timeout?: number; // Specific timeout for this command (passed down)
}

export interface Command {
  execute(query: string, options: CommandOptions): CommandGenerator;
}

export interface CommandMap {
  [key: string]: Command;
}

// Interface for the vibe-tools.config.json config file
export interface Config {
  ide?: string; // The IDE being used (cursor, claude-code, windsurf, cline, roo)
  reasoningEffort?: ReasoningEffort; // Global default reasoning effort setting
  perplexity?: {
    model?: string;
    maxTokens?: number;
  };
  plan?: {
    fileProvider: Provider;
    thinkingProvider: Provider;
    fileModel?: string;
    thinkingModel?: string;
    fileMaxTokens?: number;
    thinkingMaxTokens?: number;
  };
  repo?: {
    provider: Provider;
    model?: string;
    maxTokens?: number;
    maxRepoSizeMB?: number; // Maximum repository size in MB for remote processing
  };
  doc?: {
    maxRepoSizeMB?: number; // Maximum repository size in MB for remote processing
    provider: Provider;
    model?: string;
    maxTokens?: number;
  };
  tokenCount?: {
    encoding: 'o200k_base' | 'gpt2' | 'r50k_base' | 'p50k_base' | 'p50k_edit' | 'cl100k_base'; // The tokenizer encoding to use
  };
  browser?: {
    headless?: boolean; // Default headless mode (true/false)
    defaultViewport?: string; // Default viewport size (e.g. '1280x720')
    timeout?: number; // Default navigation timeout in milliseconds
  };
  stagehand?: {
    provider: 'anthropic' | 'openai';
    verbose?: boolean;
    debugDom?: boolean;
    enableCaching?: boolean;
  };
  web?: {
    provider?: Provider;
    model?: string;
    maxTokens?: number;
  };
  mcp?: {
    provider?: Provider;
    model?: string;
    maxTokens?: number;
    defaultServer?: string;
    overrides?: Record<
      string,
      {
        githubUrl?: string;
        command?: 'uvx' | 'npx';
        args?: string[];
      }
    >;
  };
  marketplace?: {
    model?: string;
    maxTokens?: number;
  };
  youtube?: {
    provider?: Provider;
    model?: string;
    maxTokens?: number;
    defaultType?: 'summary' | 'transcript' | 'plan' | 'review' | 'custom';
    defaultFormat?: 'markdown' | 'json' | 'text';
    maxRetries?: number;
    retryDelay?: number;
  };
}

export interface ModelOptions {
  model: string;
  maxTokens: number;
  systemPrompt?: string;
  tokenCount?: number; // For handling large token counts
  webSearch?: boolean; // Whether to enable web search capabilities
  timeout?: number; // Timeout in milliseconds for model API calls
  debug: boolean | undefined; // Enable debug logging
}

// Add video analysis options
export interface VideoAnalysisOptions extends ModelOptions {
  videoUrl: string;
  temperature?: number;
  topK?: number;
  topP?: number;
}

export interface BaseModelProvider {
  executePrompt(prompt: string, options?: ModelOptions): Promise<string>;
  supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }>;
  // Add this optional method for video analysis
  executeVideoPrompt?(prompt: string, options: VideoAnalysisOptions): Promise<string>;
}
