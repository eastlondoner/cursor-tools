export type CommandGenerator = AsyncGenerator<string, void, unknown>;

export type Provider = 'gemini' | 'openai' | 'openrouter' | 'perplexity' | 'modelbox' | 'anthropic';

// Base options shared by all commands
export interface CommandOptions {
  // Core options
  model?: string;
  maxTokens?: number;
  provider?: Provider;
  debug: boolean;
  url?: string;
  json?: boolean; // Output results as JSON

  // Output options
  saveTo?: string; // Path to save output to in addition to stdout
  quiet?: boolean; // Suppress stdout output (only useful with saveTo)

  // Context options
  hint?: string; // Additional context or hint for the AI
  subdir?: string; // Subdirectory to analyze (for repo command)

  // Plan command specific options
  fileProvider?: Provider;
  thinkingProvider?: Provider;
  fileModel?: string;
  thinkingModel?: string;
}

export interface Command {
  execute(query: string, options: CommandOptions): CommandGenerator;
}

export interface CommandMap {
  [key: string]: Command;
}

// Interface for the cursor-tools.config.json config file
export interface Config {
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
}
