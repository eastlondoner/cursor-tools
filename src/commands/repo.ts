import type { Command, CommandGenerator, CommandOptions, Provider } from '../types';
import type { Config } from '../types';
import type { AsyncReturnType } from '../utils/AsyncReturnType';
import type { ModelOptions } from '../providers/base';

import { defaultMaxTokens, loadConfig, loadEnv } from '../config';
import { pack } from 'repomix';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FileError, ProviderError } from '../errors';
import type { BaseModelProvider } from '../providers/base';
import { createProvider } from '../providers/base';
import { loadFileConfigWithOverrides } from '../repomix/repomixConfig';
import {
  getAllProviders,
  getNextAvailableProvider,
  getDefaultModel,
} from '../utils/providerAvailability';
import { getGithubRepoContext, looksLikeGithubRepo } from '../utils/githubRepo';
import { fetchDocContent } from '../utils/fetch-doc.ts';

export class RepoCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    try {
      // Handle query as GitHub repo if it looks like one and --from-github is not set
      if (query && !options?.fromGithub && looksLikeGithubRepo(query)) {
        options = { ...options, fromGithub: query };
      }

      let repoContext: string;
      let tokenCount = 0;

      if (options?.fromGithub) {
        yield `Analyzing GitHub repository: ${options.fromGithub}\n`;

        const maxRepoSizeMB = this.config.repo?.maxRepoSizeMB || 100;
        console.log(`Using maxRepoSizeMB: ${maxRepoSizeMB}`);
        console.log(`Getting GitHub repo context for: ${options.fromGithub}`);

        // Throw an error if subdir is set since we're not handling it with GitHub repos
        if (options.subdir) {
          throw new Error(
            'Subdirectory option (--subdir) is not supported with --from-github. Please clone the repository locally and use the repo command without --from-github to analyze a subdirectory.'
          );
        }

        try {
          const { text, tokenCount: repoTokenCount } = await getGithubRepoContext(
            options.fromGithub,
            maxRepoSizeMB
          );
          repoContext = text;
          tokenCount = repoTokenCount;
          console.log(`Successfully got GitHub repo context with ${tokenCount} tokens`);
        } catch (error) {
          console.error('Error getting GitHub repo context:', error);
          throw error;
        }
      } else {
        // Determine the directory to analyze. If a subdirectory is provided, resolve it relative to the current working directory.
        const targetDirectory = options.subdir
          ? resolve(process.cwd(), options.subdir)
          : process.cwd();

        // Validate that the target directory exists
        if (options.subdir && !existsSync(targetDirectory)) {
          throw new FileError(`The directory "${targetDirectory}" does not exist.`);
        }

        if (options.subdir) {
          yield `Analyzing subdirectory: ${options.subdir}\n`;
        }

        yield 'Packing repository using Repomix...\n';

        const repomixConfig = await loadFileConfigWithOverrides(targetDirectory, {
          output: {
            filePath: '.repomix-output.txt',
          },
        });

        let packResult: AsyncReturnType<typeof pack> | undefined;
        try {
          packResult = await pack([targetDirectory], repomixConfig);
          console.log(
            `Packed repository. ${packResult.totalFiles} files. Approximate size ${packResult.totalTokens} tokens.`
          );
          tokenCount = packResult.totalTokens;
        } catch (error) {
          throw new FileError('Failed to pack repository', error);
        }

        try {
          // Check if Repomix created the output file as expected
          if (!existsSync('.repomix-output.txt')) {
            // In case Repomix failed to create the output file, we'll create an empty one
            console.log('Output file does not exist after pack operation, creating an empty one');
            writeFileSync('.repomix-output.txt', '');
            repoContext = '';
          } else {
            repoContext = readFileSync('.repomix-output.txt', 'utf-8');
          }
        } catch (error) {
          throw new FileError('Failed to read repository context', error);
        }
      }

      // Fetch document content if the flag is provided
      let docContent = '';
      if (options?.withDoc) {
        if (typeof options.withDoc !== 'string') {
          // Should theoretically not happen due to yargs validation, but keep as a safeguard
          throw new Error('Invalid value provided for --with-doc. Must be a URL string.');
        }
        try {
          yield `Fetching document content from ${options.withDoc}...\n`;
          docContent = await fetchDocContent(options.withDoc, options.debug ?? false);
          yield `Successfully fetched document content.\n`;
        } catch (error) {
          console.error('Error fetching document content:', error);
          // Let the user know fetching failed but continue without it
          yield `Warning: Failed to fetch document content from ${options.withDoc}. Continuing analysis without it. Error: ${error instanceof Error ? error.message : String(error)}\n`;
        }
      }

      if (tokenCount > 200_000) {
        options.tokenCount = tokenCount;
      }

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
          options,
          docContent
        );
        return;
      }

      // Otherwise try providers in preference order
      let currentProvider = getNextAvailableProvider('repo');
      while (currentProvider) {
        try {
          yield* this.tryProvider(
            currentProvider,
            query,
            repoContext,
            cursorRules,
            options,
            docContent
          );
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
    options: CommandOptions,
    docContent: string
  ): CommandGenerator {
    const modelProvider = createProvider(provider);
    const modelName =
      options?.model ||
      this.config.repo?.model ||
      (this.config as Record<string, any>)[provider]?.model ||
      getDefaultModel(provider);

    if (!modelName) {
      throw new ProviderError(`No model specified for ${provider}`);
    }

    yield `Analyzing repository using ${modelName}...\n`;
    try {
      const maxTokens =
        options?.maxTokens ||
        this.config.repo?.maxTokens ||
        (this.config as Record<string, any>)[provider]?.maxTokens ||
        defaultMaxTokens;

      // Simplify modelOptions creation - pass only relevant options
      // The analyzeRepository function will construct the full ModelOptions internally
      const modelOptsForAnalysis: Partial<ModelOptions> & { model: string } = {
        model: modelName,
        maxTokens,
        debug: options?.debug,
        tokenCount: options?.tokenCount,
      };

      const response = await analyzeRepository(
        modelProvider,
        {
          query,
          repoContext,
          cursorRules,
          docContent,
        },
        modelOptsForAnalysis // Pass the simplified options
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
  props: { query: string; repoContext: string; cursorRules: string; docContent: string },
  options: Partial<ModelOptions> & { model: string } // Expect partial options + model
): Promise<string> {
  const { query, repoContext, cursorRules, docContent } = props;
  const { model, maxTokens, webSearch, tokenCount, timeout, debug } = options;

  // Construct the full prompt
  let fullPrompt = query;

  if (docContent) {
    fullPrompt = `CONTEXT DOCUMENT:\n${docContent}\n\nUSER QUERY:\n${query}`;
  }

  // Construct the final prompt
  const finalPrompt = `${cursorRules}\n\n${repoContext}\n\n${fullPrompt}`;

  // Construct the full ModelOptions here
  const finalModelOptions: ModelOptions = {
    model: model, // Use required model name
    maxTokens: maxTokens ?? defaultMaxTokens, // Use provided or default maxTokens
    systemPrompt:
      "You are an expert software developer analyzing a repository and potentially a document. Provide a comprehensive response to the user's request, considering both the code context and any provided document content. Include a list of relevant files. Follow user instructions exactly.",
    // Pass through optional values
    debug: debug,
    tokenCount: tokenCount,
    webSearch: webSearch,
    timeout: timeout,
    reasoningEffort: options.reasoningEffort,
  };

  return provider.executePrompt(finalPrompt, finalModelOptions);
}
