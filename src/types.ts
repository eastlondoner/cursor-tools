export type CommandGenerator = AsyncGenerator<string, void, unknown>;

export type Provider = 'gemini' | 'openai' | 'openrouter';

// Base options shared by all commands
export interface CommandOptions {
  // Core options
  model?: string;
  maxTokens?: number;
  provider?: Provider;
  debug?: boolean;
  url?: string;
  
  // Output options
  saveTo?: string; // Path to save output to in addition to stdout
  
  // Context options
  hint?: string; // Additional context or hint for the AI
  
  // Plan command specific options
  fileProvider?: Provider;
  thinkingProvider?: Provider;
  fileModel?: string;
  thinkingModel?: string;
}

export interface Command {
  execute(query: string, options?: CommandOptions): CommandGenerator;
}

export interface CommandMap {
  [key: string]: Command;
}

export interface Config {
  perplexity: {
    model: string;
    apiKey?: string;
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
  gemini: {
    model: string;
    apiKey?: string;
    maxTokens?: number;
  }
  repo?: {
    provider: Provider;
    model?: string;
    maxTokens?: number;
  };
  doc?: {
    maxRepoSizeMB?: number; // Maximum repository size in MB for remote processing
    provider: Provider;
    model?: string;
    maxTokens?: number;
  };
  tokenCount?: {
    encoding: 'o200k_base' | 'gpt2' | 'r50k_base' | 'p50k_base' | 'p50k_edit' | 'cl100k_base';
  };
  browser?: {
    headless?: boolean;
    defaultViewport?: string;
    timeout?: number;
  };
  stagehand?: {
    provider: 'anthropic' | 'openai';
    verbose?: boolean;
    debugDom?: boolean;
    enableCaching?: boolean;
  };
}
