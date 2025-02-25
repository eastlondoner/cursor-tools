import type { Command, CommandGenerator, CommandOptions, Provider } from '../types';
import type { Config } from '../types';
import { defaultMaxTokens, loadConfig, loadEnv } from '../config';
import { pack } from 'repomix';
import { readFileSync } from 'node:fs';
import { FileError, ProviderError } from '../errors';
import type { ModelOptions, BaseModelProvider } from '../providers/base';
import { createProvider } from '../providers/base';
import { ignorePatterns, includePatterns, outputOptions } from '../repomix/repomixConfig';

const DEFAULT_REPO_MODELS: Record<Provider, string> = {
  gemini: 'gemini-2.0-flash-thinking-exp',
  openai: 'o3-mini',
  anthropic: 'claude-3-7-sonnet-latest',
  modelbox: 'google/gemini-2.0-flash-thinking',
  openrouter: 'google/gemini-2.0-pro-exp-02-05:free',
  perplexity: 'sonar-reasoning-pro',
};

export class RepoCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  getDescription(): string {
    return 'Get context-aware answers about this repository using Google Gemini';
  }

  getHelp(): string {
    return `Repository Command - Get context-aware answers about this repository

Usage: cursor-tools repo "<query>" [options]

Options:
  --provider=<provider>    AI provider to use (gemini, openai, openrouter, perplexity, or modelbox)
  --model=<model>         Model to use for repository analysis
  --max-tokens=<number>   Maximum tokens for response
  --save-to=<file path>   Save output to a file (in addition to stdout)

Examples:
  cursor-tools repo "explain authentication flow"
  cursor-tools repo "review recent changes to error handling"
  cursor-tools repo "find security vulnerabilities in the codebase"
  cursor-tools repo "suggest improvements to the API design"

Notes:
- Uses Google Gemini by default for repository analysis
- Has a 2M token context window for large codebases
- Context can be reduced using .repomixignore file
- Provides code-aware responses with file references
- Can analyze code patterns and suggest improvements
- Ideal for code review and architecture discussions

Dependencies:
- Requires API key for chosen provider in .cursor-tools.env
- Uses repomix for repository context management`;
  }

  async *execute(query: string, options?: CommandOptions): CommandGenerator {
    try {
      yield 'Packing repository using Repomix...\n';

      try {
        const packResult = await pack([process.cwd()], {
          output: {
            ...outputOptions,
            filePath: '.repomix-output.txt',
          },
          include: includePatterns,
          ignore: {
            useGitignore: true,
            useDefaultPatterns: true,
            customPatterns: ignorePatterns,
          },
          security: {
            enableSecurityCheck: true,
          },
          tokenCount: {
            encoding: this.config.tokenCount?.encoding || 'o200k_base',
          },
          cwd: process.cwd(),
        });
        console.log(
          `Packed repository. ${packResult.totalFiles} files. Approximate size ${packResult.totalTokens} tokens.`
        );
      } catch (error) {
        throw new FileError('Failed to pack repository', error);
      }

      let repoContext: string;
      try {
        repoContext = readFileSync('.repomix-output.txt', 'utf-8');
      } catch (error) {
        throw new FileError('Failed to read repository context', error);
      }

      let cursorRules =
        'If generating code observe rules from the .cursorrules file and contents of the .cursor/rules folder';

      const provider = createProvider(options?.provider || this.config.repo?.provider || 'gemini');
      const providerName = options?.provider || this.config.repo?.provider || 'gemini';

      // Configuration hierarchy
      const model =
        options?.model ||
        this.config.repo?.model ||
        (this.config as Record<string, any>)[providerName]?.model ||
        DEFAULT_REPO_MODELS[providerName];
      const maxTokens =
        options?.maxTokens ||
        this.config.repo?.maxTokens ||
        (this.config as Record<string, any>)[providerName]?.maxTokens ||
        defaultMaxTokens;

      if (!model) {
        throw new ProviderError(`No model specified for ${providerName}`);
      }

      yield `Analyzing repository using ${model}...\n`;
      try {
        const response = await analyzeRepository(provider, query, repoContext, cursorRules, {
          model,
          maxTokens,
          debug: options?.debug,
          systemPrompt:
            "You are an expert software developer analyzing a repository. Follow user instructions exactly and satisfy the user's request.",
        });
        yield response;
      } catch (error) {
        throw new ProviderError(
          error instanceof Error ? error.message : 'Unknown error during analysis',
          error
        );
      }
    } catch (error) {
      if (error instanceof FileError || error instanceof ProviderError) {
        yield error.formatUserMessage(options?.debug);
      } else if (error instanceof Error) {
        yield `Error: ${error.message}\n`;
      } else {
        yield 'An unknown error occurred\n';
      }
    }
  }
}

async function analyzeRepository(
  provider: BaseModelProvider,
  query: string,
  repoContext: string,
  cursorRules: string,
  options?: ModelOptions
): Promise<string> {
  return provider.executePrompt(`${cursorRules}\n\n${repoContext}\n\n${query}`, options);
}
