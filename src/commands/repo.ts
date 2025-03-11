import type { Command, CommandGenerator, CommandOptions, Provider } from '../types';
import type { Config } from '../types';
import { defaultMaxTokens, loadConfig, loadEnv } from '../config';
import { pack } from 'repomix';
import { Mode, readFileSync } from 'node:fs';
import { FileError, ProviderError } from '../errors';
import type { ModelOptions, BaseModelProvider } from '../providers/base';
import { createProvider } from '../providers/base';
import { ignorePatterns, includePatterns, outputOptions } from '../repomix/repomixConfig';
import {
  getAllProviders,
  getNextAvailableProvider,
  getDefaultModel,
} from '../utils/providerAvailability';
import { AsyncReturnType } from '../utils/AsyncReturnType';

export class RepoCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  async *execute(query: string, options: CommandOptions & Partial<ModelOptions>): CommandGenerator {
    try {
      let cursorRules =
        'If generating code observe rules from the .cursorrules file and contents of the .cursor/rules folder';

      const providerName = options?.provider || this.config.repo?.provider || 'gemini';

      if (!getAllProviders().find((p) => p.provider === providerName)) {
        throw new ProviderError(
          `Unrecognized provider: ${providerName}. Try one of ${getAllProviders()
            .filter((p) => p.available)
            .map((p) => p.provider)
            .join(', ')}`
        );
      }

      yield 'Packing repository using Repomix...\n';

      let packResult: AsyncReturnType<typeof pack> | undefined;
      try {
        packResult = await pack([process.cwd()], {
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

      if (packResult?.totalTokens > 200_000) {
        options.tokenCount = packResult.totalTokens;
      }

      let repoContext: string;
      try {
        repoContext = readFileSync('.repomix-output.txt', 'utf-8');
      } catch (error) {
        throw new FileError('Failed to read repository context', error);
      }

      // If provider is explicitly specified, try only that provider
      if (options?.provider) {
        const providerInfo = getAllProviders().find((p) => p.provider === options.provider);
        if (!providerInfo?.available) {
          throw new ProviderError(
            `Provider ${options.provider} is not available. Please check your API key configuration.`,
            `Try one of ${getAllProviders()
              .filter((p) => p.available)
              .map((p) => p.provider)
              .join(', ')}`
          );
        }
        yield* this.tryProvider(
          options.provider as Provider,
          query,
          repoContext,
          cursorRules,
          options
        );
        return;
      }

      // Otherwise try providers in preference order
      let currentProvider = getNextAvailableProvider('repo');
      while (currentProvider) {
        try {
          yield* this.tryProvider(currentProvider, query, repoContext, cursorRules, options);
          return; // If successful, we're done
        } catch (error) {
          console.error(
            `Provider ${currentProvider} failed:`,
            error instanceof Error ? error.message : error
          );
          yield `Provider ${currentProvider} failed, trying next available provider...\n`;
          currentProvider = getNextAvailableProvider('repo', currentProvider);
        }
      }

      // If we get here, no providers worked
      throw new ProviderError(
        'No suitable AI provider available for repo command. Please ensure at least one of the following API keys are set: GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, PERPLEXITY_API_KEY, MODELBOX_API_KEY.'
      );
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

  private async *tryProvider(
    provider: Provider,
    query: string,
    repoContext: string,
    cursorRules: string,
    options: CommandOptions & Partial<ModelOptions>
  ): CommandGenerator {
    const modelProvider = createProvider(provider);
    const model =
      options?.model ||
      this.config.repo?.model ||
      (this.config as Record<string, any>)[provider]?.model ||
      getDefaultModel(provider);

    if (!model) {
      throw new ProviderError(`No model specified for ${provider}`);
    }

    yield `Analyzing repository using ${model}...\n`;
    try {
      const maxTokens =
        options?.maxTokens ||
        this.config.repo?.maxTokens ||
        (this.config as Record<string, any>)[provider]?.maxTokens ||
        defaultMaxTokens;

      const response = await analyzeRepository(
        modelProvider,
        {
          query,
          repoContext,
          cursorRules,
        },
        {
          ...options,
          model,
          maxTokens,
        }
      );
      yield response;
    } catch (error) {
      throw new ProviderError(
        error instanceof Error ? error.message : 'Unknown error during analysis',
        error
      );
    }
  }
}

async function analyzeRepository(
  provider: BaseModelProvider,
  props: { query: string; repoContext: string; cursorRules: string },
  options: Omit<ModelOptions, 'systemPrompt'>
): Promise<string> {
  return provider.executePrompt(`${props.cursorRules}\n\n${props.repoContext}\n\n${props.query}`, {
    ...options,
    systemPrompt:
      "You are an expert software developer analyzing a repository. Follow user instructions exactly and satisfy the user's request.",
  });
}
