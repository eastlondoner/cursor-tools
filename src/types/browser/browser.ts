import type { z } from 'zod';

// Core Stagehand API interface
export interface Stagehand {
  act(action: string): Promise<void>;
  extract<T>(schema: z.ZodType<T>): Promise<T>;
  observe(): Promise<ObservationResult>;
}

// Configuration options
export interface StagehandConfig {
  env: 'LOCAL' | 'BROWSERBASE';
  headless: boolean;
  verbose: 0 | 1 | 2;
  debugDom: boolean;
  enableCaching: boolean;
  browserbaseApiKey?: string;
  browserbaseProjectId?: string;
  llmProvider?: LLMProvider;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
}

export type LLMProvider = 'openai' | 'anthropic' | 'google';

// Stagehand method options
export interface ActOptions {
  instruction: string;
  timeout?: number;
  retries?: number;
}

export interface ExtractOptions {
  timeout?: number;
  retries?: number;
}

export interface ObserveOptions {
  timeout?: number;
  retries?: number;
}

// Observation result type
export interface ObservationResult {
  elements: {
    type: string;
    description: string;
    actions: string[];
    location: string;
  }[];
  summary: string;
}

// Command options shared across all browser commands
export interface BrowserCommandOptions {
  url: string;
  debug?: boolean;
  saveTo?: string;
  headless?: boolean;
  timeout?: number;
  viewport?: {
    width: number;
    height: number;
  };
}

// Extract command specific options
export interface ExtractCommandOptions extends BrowserCommandOptions {
  schema?: string | object;
}

// Act command specific options
export interface ActCommandOptions extends BrowserCommandOptions {
  instruction: string;
}

// Observe command specific options
export interface ObserveCommandOptions extends BrowserCommandOptions {
  instruction?: string;
}
