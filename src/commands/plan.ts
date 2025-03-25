import type { Command, CommandGenerator, CommandOptions, Config } from '../types';
import { defaultMaxTokens, loadConfig, loadEnv } from '../config';
import { pack } from 'repomix';
import { readFileSync } from 'node:fs';
import type { ModelOptions, BaseModelProvider } from '../providers/base';
import { createProvider } from '../providers/base';
import { FileError, ProviderError } from '../errors';
import { loadFileConfigWithOverrides } from '../repomix/repomixConfig';

type FileProvider = 'gemini' | 'openai' | 'openrouter' | 'perplexity' | 'modelbox' | 'anthropic';
type ThinkingProvider =
  | 'gemini'
  | 'openai'
  | 'openrouter'
  | 'perplexity'
  | 'modelbox'
  | 'anthropic';

// Plan-specific options interface
interface PlanCommandOptions extends CommandOptions {
  fileProvider?: FileProvider;
  thinkingProvider?: ThinkingProvider;
  fileModel?: string;
  thinkingModel?: string;
}

const DEFAULT_FILE_MODELS: Record<FileProvider, string> = {
  gemini: 'gemini-2.5-pro-exp', // largest context window (2M tokens)
  openai: 'o3-mini', // largest context window (200k)
  perplexity: 'sonar-pro', // largest context window (200k tokens)
  openrouter: 'google/gemini-2.5-pro-exp-03-25:free', // largest context window (2M tokens)
  modelbox: 'google/gemini-2.5-pro-exp',
  anthropic: 'claude-3-7-sonnet-latest',
};

const DEFAULT_THINKING_MODELS: Record<ThinkingProvider, string> = {
  gemini: 'gemini-2.0-flash-thinking-exp',
  openai: 'o3-mini',
  perplexity: 'r1-1776',
  openrouter: 'openai/o3-mini',
  modelbox: 'anthropic/claude-3-7-sonnet-thinking',
  anthropic: 'claude-3-7-sonnet-latest',
};

export class PlanCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  async *execute(query: string, options: PlanCommandOptions): CommandGenerator {
    try {
      // Check for conflicting model options
      if (options?.model && options?.thinkingModel) {
        throw new Error(
          'Cannot specify both --model and --thinkingModel options. Use --model to set the thinking model.'
        );
      }

      const fileProviderName = options?.fileProvider || this.config.plan?.fileProvider || 'gemini';
      const fileProvider = createProvider(fileProviderName);
      const thinkingProviderName =
        options?.thinkingProvider || this.config.plan?.thinkingProvider || 'openai';
      const thinkingProvider = createProvider(thinkingProviderName);

      const fileModel =
        options?.fileModel ||
        this.config.plan?.fileModel ||
        (this.config as Record<string, any>)[fileProviderName]?.model ||
        DEFAULT_FILE_MODELS[fileProviderName as keyof typeof DEFAULT_FILE_MODELS];
      const thinkingModel =
        options?.thinkingModel ||
        options?.model || // Use --model for thinking model if specified
        this.config.plan?.thinkingModel ||
        (this.config as Record<string, any>)[thinkingProviderName]?.model ||
        DEFAULT_THINKING_MODELS[thinkingProviderName as keyof typeof DEFAULT_THINKING_MODELS];

      yield `Using file provider: ${fileProviderName}\n`;
      yield `Using file model: ${fileModel}\n`;
      yield `Using thinking provider: ${thinkingProviderName}\n`;
      yield `Using thinking model: ${thinkingModel}\n`;

      yield 'Finding relevant files...\n';

      // Get file listing
      let packedRepo: string;
      try {
        yield 'Running repomix to get file listing...\n';

        const repomixDirectory = process.cwd();
        const tempFile = '.repomix-plan-files.txt';
        const repomixConfig = await loadFileConfigWithOverrides(repomixDirectory, {
          output: {
            filePath: tempFile,
          },
        });
        const repomixResult = await pack([repomixDirectory], repomixConfig);

        if (options?.debug) {
          yield 'Repomix completed successfully.\n';
        }

        // TODO: this seems like an expensive way to get a list of files
        packedRepo = readFileSync(tempFile, 'utf-8');

        yield `Found ${repomixResult.totalFiles} files, approx ${repomixResult.totalTokens} tokens.\n`;
        if (options?.debug) {
          yield 'First few files:\n';
          yield `${packedRepo.split('\n').slice(0, 5).join('\n')}\n\n`;
          yield 'File listing format check:\n';
          yield `First 200 characters: ${JSON.stringify(packedRepo.slice(0, 200))}\n`;
          yield `Last 200 characters: ${JSON.stringify(packedRepo.slice(-200))}\n\n`;
        }
      } catch (error) {
        throw new FileError('Failed to get file listing', error);
      }

      // Get relevant files
      let filePaths: string[];
      try {
        const maxTokens =
          options?.maxTokens ||
          this.config.plan?.fileMaxTokens ||
          (this.config as Record<string, any>)[fileProviderName]?.maxTokens ||
          defaultMaxTokens;
        yield `Asking ${fileProviderName} to identify relevant files using model: ${fileModel} with max tokens: ${maxTokens}...\n`;

        if (options?.debug) {
          yield 'Provider configuration:\n';
          yield `Provider: ${fileProviderName}\n`;
          yield `Model: ${fileModel}\n`;
          yield `Max tokens: ${options?.maxTokens || this.config.plan?.fileMaxTokens}\n\n`;
        }

        filePaths = await getRelevantFiles(fileProvider, query, packedRepo, {
          model: fileModel,
          maxTokens,
          debug: options?.debug,
        });

        if (options?.debug) {
          yield 'AI response received.\n';
          yield `Number of files identified: ${filePaths?.length || 0}\n`;
          if (filePaths?.length > 0) {
            yield 'First few identified files:\n';
            yield `${filePaths.slice(0, 5).join('\n')}\n\n`;
          } else {
            yield 'No files were identified.\n\n';
          }
        }
      } catch (error) {
        console.error('Error in getRelevantFiles', error);
        throw new ProviderError('Failed to identify relevant files', error);
      }

      if (filePaths.length === 0) {
        yield 'No relevant files found. Please refine your query.\n';
        return;
      }

      yield `Found ${filePaths.length} relevant files:\n${filePaths.join('\n')}\n\n`;

      yield 'Extracting content from relevant files...\n';
      let filteredContent: string;
      try {
        const tempFile = '.repomix-plan-filtered.txt';
        const repomixDirectory = process.cwd();
        const repomixConfig = await loadFileConfigWithOverrides(repomixDirectory, {
          output: {
            filePath: tempFile,
          },
          include: filePaths,
        });
        const filteredResult = await pack([repomixDirectory], repomixConfig);

        if (options?.debug) {
          yield 'Content extraction completed.\n';
          yield `Extracted content size: ${filteredResult.totalTokens} tokens\n`;
        }

        filteredContent = readFileSync(tempFile, 'utf-8');
      } catch (error) {
        throw new FileError('Failed to extract content', error);
      }

      const maxTokens =
        options?.maxTokens ||
        this.config.plan?.thinkingMaxTokens ||
        (this.config as Record<string, any>)[thinkingProviderName]?.maxTokens ||
        defaultMaxTokens;
      yield `Generating implementation plan using ${thinkingProviderName} with max tokens: ${maxTokens}...\n`;
      let plan: string;
      try {
        plan = await generatePlan(thinkingProvider, query, filteredContent, {
          model: thinkingModel,
          maxTokens: maxTokens,
          debug: options?.debug,
        });
      } catch (error) {
        console.error('Error in generatePlan', error);
        throw new ProviderError('Failed to generate implementation plan', error);
      }

      yield plan;
    } catch (error) {
      // console.error errors and then throw
      if (error instanceof FileError || error instanceof ProviderError) {
        console.error('Error in plan command', error);
        if (error.details && options?.debug) {
          console.error(`Debug details: ${JSON.stringify(error.details, null, 2)}`);
        }
        throw error;
      } else if (error instanceof Error) {
        console.error('Error in plan command', error);
        throw error;
      } else {
        console.error('An unknown error occurred in plan command');
        throw new Error('An unknown error occurred in plan command');
      }
    }
  }
}

// Shared functionality for plan providers
function parseFileList(fileListText: string): string[] {
  // First try to parse as a comma-separated list
  const files = fileListText
    .split(/[,\n]/) // Split on commas or newlines
    .map((f) => f.trim())
    .map((f) => f.replace(/[`'"]/g, '')) // Remove quotes and backticks
    .filter((f) => f.length > 0 && !f.includes('*')); // Filter empty lines and wildcards

  if (files.length > 0) {
    return files;
  }

  // If no files found, try to extract paths using a regex
  const pathRegex = /(?:^|\s|["'`])([a-zA-Z0-9_\-/.]+\.[a-zA-Z0-9]+)(?:["'`]|\s|$)/g;
  const matches = Array.from(fileListText.matchAll(pathRegex), (m) => m[1]);
  return matches.filter((f) => f.length > 0);
}

const FIVE_MINUTES = 300000;

// Pure functions for plan operations
async function getRelevantFiles(
  provider: BaseModelProvider,
  query: string,
  fileListing: string,
  options: Omit<ModelOptions, 'systemPrompt'>
): Promise<string[]> {
  const timeoutMs = FIVE_MINUTES;
  const response = await provider.executePrompt(
    `Identify files that are relevant to the following query:

Query: ${query}

Below are the details of all files in the repository. Return ONLY a comma-separated list of file paths that are relevant to the query.
Do not include any other text, explanations, or markdown formatting. Just the file paths separated by commas.

Files:
${fileListing}`,
    {
      ...options,
      timeout: timeoutMs,
      systemPrompt:
        'You are an expert software developer. You must return ONLY a comma-separated list of file paths. No other text or formatting.',
    }
  );
  return parseFileList(response);
}

const TEN_MINUTES = 600000;

async function generatePlan(
  provider: BaseModelProvider,
  query: string,
  repoContext: string,
  options: Omit<ModelOptions, 'systemPrompt'>
): Promise<string> {
  const timeoutMs = TEN_MINUTES;
  const startTime = Date.now();
  console.log(
    `[${new Date().toLocaleTimeString()}] Generating plan using ${provider.constructor.name} with timeout: ${timeoutMs}ms...`
  );

  try {
    // Create model options with all required parameters
    const modelOptions: ModelOptions = {
      ...options,
      systemPrompt:
        'You are an expert software engineer who generates step-by-step implementation plans for software development tasks. Given a query and a repository context, generate a detailed plan that is consistent with the existing code. Include specific file paths, code snippets, and any necessary commands. Identify assumptions and provide multiple possible options where appropriate.',
      timeout: timeoutMs,
    };

    const result = await provider.executePrompt(
      `Query: ${query}\n\nRepository Context:\n${repoContext}`,
      modelOptions
    );

    const endTime = Date.now();
    console.log(
      `[${new Date().toLocaleTimeString()}] Plan generation completed in ${((endTime - startTime) / 1000).toFixed(2)} seconds.`
    );
    return result;
  } catch (error) {
    const endTime = Date.now();
    console.error(
      `[${new Date().toLocaleTimeString()}] Plan generation failed after ${((endTime - startTime) / 1000).toFixed(2)} seconds.`
    );
    throw error;
  }
}
