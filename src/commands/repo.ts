import type { Command, CommandGenerator, CommandOptions } from '../types';
import type { Config } from '../config';
import { loadConfig, loadEnv } from '../config';
import { pack } from 'repomix';
import { readFileSync } from 'node:fs';
import { FileError, ProviderError } from '../errors';
import type { ModelOptions, BaseModelProvider } from '../providers/base';
import { GeminiProvider, OpenAIProvider, OpenRouterProvider } from '../providers/base';
import { ModelNotFoundError } from '../errors';

export class RepoCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  async *execute(query: string, options?: CommandOptions): CommandGenerator {
    try {
      yield 'Packing repository using repomix...\n';

      try {
        await pack(process.cwd(), {
          output: {
            filePath: '.repomix-output.txt',
            style: 'plain',
            parsableStyle: false,
            fileSummary: false,
            directoryStructure: true,
            removeComments: false,
            removeEmptyLines: true,
            showLineNumbers: false,
            copyToClipboard: false,
            includeEmptyDirectories: false,
            topFilesLength: 1000
          },
          include: ['**/*'],
          ignore: {
            useGitignore: true,
            useDefaultPatterns: true,
            customPatterns: []
          },
          security: {
            enableSecurityCheck: true
          },
          tokenCount: {
            encoding: this.config.tokenCount?.encoding || 'o200k_base'
          },
          cwd: process.cwd()
        });
      } catch (error) {
        throw new FileError('Failed to pack repository', error);
      }

      let repoContext: string;
      try {
        repoContext = readFileSync('.repomix-output.txt', 'utf-8');
      } catch (error) {
        throw new FileError('Failed to read repository context', error);
      }

      let cursorRules = '';
      try {
        cursorRules = readFileSync('.cursorrules', 'utf-8');
      } catch {
        // Ignore if .cursorrules doesn't exist
      }

      const provider = createRepoProvider(options?.provider || this.config.repo?.provider || 'gemini');
      const providerName = options?.provider || this.config.repo?.provider || 'gemini';
      const model = options?.model || this.config?.repo?.model;

      if (!model) {
        throw new ProviderError(`No model specified for ${providerName}`);
      }

      yield `Analyzing repository using ${model}...\n`;
      try {
        const response = await provider.analyzeRepository(query, repoContext, cursorRules, {
          model,
          maxTokens: options?.maxTokens || this.config.repo?.maxTokens
        });
        yield response;
      } catch (error) {
        throw new ProviderError(error instanceof Error ? error.message : 'Unknown error during analysis', error);
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

// Repository-specific provider interface
export interface RepoModelProvider extends BaseModelProvider {
  analyzeRepository(query: string, repoContext: string, cursorRules: string, options?: ModelOptions): Promise<string>;
}

// Shared mixin for repo providers
const RepoProviderMixin = {
  async analyzeRepository(this: BaseModelProvider, query: string, repoContext: string, cursorRules: string, options?: ModelOptions): Promise<string> {
    return this.executePrompt(
      `${cursorRules}\n\n${repoContext}\n\n${query}`,
      {
        ...options,
        systemPrompt: 'You are an expert software developer analyzing a repository. Provide clear, actionable insights and recommendations.'
      }
    );
  }
};

// Repository provider implementations
export class RepoGeminiProvider extends GeminiProvider implements RepoModelProvider {
  analyzeRepository = RepoProviderMixin.analyzeRepository;
}

export class RepoOpenAIProvider extends OpenAIProvider implements RepoModelProvider {
  analyzeRepository = RepoProviderMixin.analyzeRepository;
}

export class RepoOpenRouterProvider extends OpenRouterProvider implements RepoModelProvider {
  analyzeRepository = RepoProviderMixin.analyzeRepository;
}

// Factory function to create providers
export function createRepoProvider(provider: 'gemini' | 'openai' | 'openrouter'): RepoModelProvider {
  switch (provider) {
    case 'gemini':
      return new RepoGeminiProvider();
    case 'openai':
      return new RepoOpenAIProvider();
    case 'openrouter':
      return new RepoOpenRouterProvider();
    default:
      throw new ModelNotFoundError(provider);
  }
} 