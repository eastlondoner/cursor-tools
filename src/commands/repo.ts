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
  getNextAvailableProvider,
  getDefaultModel,
  getProviderInfo,
  getAvailableProviders,
  isProviderAvailable,
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
      if (options?.withDoc && Array.isArray(options.withDoc) && options.withDoc.length > 0) {
        try {
          const urls = options.withDoc;
          yield `Fetching document content from ${urls.length} URLs: ${urls.join(', ')}...\n`;
          docContent = await fetchDocContent(urls, options.debug ?? false);
          yield `Successfully fetched combined document content.\n`;
        } catch (error) {
          const urls = options.withDoc;
          console.error(
            `Error fetching document content from one or more URLs: ${urls.join(', ')}`,
            error
          );
          yield `Warning: Failed to fetch document content from one or more URLs (${urls.join(', ')}). Continuing analysis without it. Error: ${error instanceof Error ? error.message : String(error)}\n`;
        }
      } else if (options?.withDoc) {
        console.warn(
          '--with-doc was provided but not as a non-empty array of URLs. Proceeding without document context.'
        );
      }

      if (tokenCount > 200_000) {
        options.tokenCount = tokenCount;
      }

      let cursorRules =
        'If generating code observe rules from the .cursorrules file and contents of the .cursor/rules folder';

      const providerName = options?.provider || this.config.repo?.provider || 'gemini';
      const availableProvidersList = getAvailableProviders()
        .map((p) => p.provider)
        .join(', ');

      if (!getProviderInfo(providerName)) {
        throw new ProviderError(
          `Unrecognized provider: ${providerName}.`,
          `Try one of ${availableProvidersList}`
        );
      }

      // If provider is explicitly specified, try only that provider
      if (options?.provider) {
        if (!isProviderAvailable(options.provider)) {
          throw new ProviderError(
            `Provider ${options.provider} is not available. Please check your API key configuration.`,
            `Try one of ${availableProvidersList}`
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

      let currentProvider = null;

      const noAvailableProvidersMsg =
        'No suitable AI provider available for repo command. Please ensure at least one of the following API keys are set in your ~/.cursor-tools/.env file: GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, PERPLEXITY_API_KEY, MODELBOX_API_KEY.';

      if (this.config.repo?.provider && isProviderAvailable(this.config.repo?.provider)) {
        currentProvider = this.config.repo.provider;
      }

      if (!currentProvider) {
        currentProvider = getNextAvailableProvider('repo');
      }

      if (!currentProvider) {
        throw new ProviderError(noAvailableProvidersMsg);
      }

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
      throw new ProviderError(noAvailableProvidersMsg);
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
    console.log(`Trying provider: ${provider}`);
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

      // Pass docContent to analyzeRepository
      const analysisResult = await analyzeRepository(
        modelProvider,
        {
          query,
          repoContext,
          cursorRules,
          docContent,
        },
        {
          model: modelName,
          maxTokens,
          debug: options.debug,
          tokenCount: options.tokenCount,
        }
      );
      yield analysisResult;
    } catch (error) {
      if (error instanceof Error) {
        throw new ProviderError(
          `Error analyzing repository with ${provider}: ${error.message}`,
          error
        );
      } else {
        throw new ProviderError(`Unknown error analyzing repository with ${provider}`, error);
      }
    }
  }
}

async function analyzeRepository(
  provider: BaseModelProvider,
  props: { query: string; repoContext: string; cursorRules: string; docContent: string },
  options: Omit<ModelOptions, 'systemPrompt'> & { model: string } // Expect partial options + model
): Promise<string> {
  const { query, repoContext, cursorRules, docContent } = props;

  // Construct the system prompt
  let systemPrompt = `You are an AI assistant specialized in analyzing software repositories.
Analyze the provided repository content (\`repoContext\`) and answer the user's query (\`query\`).
${cursorRules ? `\n${cursorRules}` : ''}`;

  // Add document context to the system prompt if available
  if (docContent) {
    systemPrompt += `\n\nAdditionally, consider the following external document content when analyzing the repository and answering the query:

--- Document Context ---
${docContent}
--- End Document Context ---`;
  }

  const prompt = `User Query: ${query}\n\nRepository Content:\n\`\`\`\n${repoContext}\n\`\`\`\n\nAnswer the user query based on the repository content${docContent ? ' and the provided document context' : ''}.`;

  // Combine props and options, ensuring model is included for executePrompt
  const fullOptions: ModelOptions = {
    ...options,
    systemPrompt,
    // Ensure other fields like maxTokens, debug, etc., are passed correctly if they exist in options
  };

  // Execute the prompt
  const result = await provider.executePrompt(prompt, fullOptions);
  return result;
}
