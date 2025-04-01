import type { Command, CommandGenerator, CommandOptions, Config, Provider } from '../types';
import { defaultMaxTokens, loadConfig, loadEnv } from '../config';
import { pack } from 'repomix';
import { readFileSync } from 'node:fs';
import { ApiKeyMissingError, CursorToolsError, FileError, ProviderError } from '../errors';
import type { ModelOptions, BaseModelProvider } from '../providers/base';
import { createProvider } from '../providers/base';
import { ModelNotFoundError } from '../errors';
import { loadFileConfigWithOverrides } from '../repomix/repomixConfig';
import {
  getAllProviders,
  getNextAvailableProvider,
  getDefaultModel,
  PROVIDER_PREFERENCE,
} from '../utils/providerAvailability';
import { getGithubRepoContext, looksLikeGithubRepo, parseGithubUrl } from '../utils/githubRepo';

interface DocCommandOptions extends CommandOptions {
  model: string;
  maxTokens?: number;
  fromGithub?: string;
  hint?: string;
  debug: boolean;
  provider?: Provider;
  subdir?: string;
}

export class DocCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  async *execute(query: string, options: DocCommandOptions): CommandGenerator {
    try {
      console.error('Generating repository documentation...\n');

      // Handle query as GitHub repo if it looks like one and --from-github is not set
      if (query && !options?.fromGithub && looksLikeGithubRepo(query)) {
        options = { ...options, fromGithub: query };
      } else if (query) {
        // Use query as hint if it's not a repo reference
        options = {
          ...options,
          hint: options?.hint ? `${options.hint}\n\n${query}` : query,
        };
      }

      // Validate API keys before proceeding
      this.validateApiKeys(options);

      let repoContext: { text: string; tokenCount: number };

      if (options?.hint) {
        query += `\nHint: ${options.hint}\n`;
      }

      if (options?.fromGithub) {
        console.error(`Fetching repository context for ${options.fromGithub}...\n`);

        // Throw an error if subdir is set since we're not handling it with GitHub repos
        if (options.subdir) {
          throw new Error(
            'Subdirectory option (--subdir) is not supported with --from-github. Please clone the repository locally and use the doc command without --from-github to analyze a subdirectory.'
          );
        }

        const maxRepoSizeMB = this.config.doc?.maxRepoSizeMB || 100;
        repoContext = await getGithubRepoContext(options.fromGithub, maxRepoSizeMB);
      } else {
        console.error('Packing local repository using repomix...\n');
        const repomixDirectory = process.cwd();
        const tempFile = '.repomix-output.txt';
        const repomixConfig = await loadFileConfigWithOverrides(repomixDirectory, {
          output: {
            filePath: tempFile,
          },
        });
        try {
          const packResult = await pack([repomixDirectory], repomixConfig);
          try {
            repoContext = {
              text: readFileSync(tempFile, 'utf-8'),
              tokenCount: packResult.totalTokens,
            };
          } catch (error) {
            throw new FileError('Failed to read repository context', error);
          }
        } catch (error) {
          throw new FileError('Failed to pack repository', error);
        }
      }

      // Check if repository is empty or nearly empty
      const isEmptyRepo = repoContext.text.trim() === '' || repoContext.tokenCount < 50;
      if (isEmptyRepo) {
        console.error('Repository appears to be empty or contains minimal code.');
        yield '\n\n\u2139\uFE0F Repository Notice: This repository appears to be empty or contains minimal code.\n';
        yield 'Basic structure documentation:\n';

        // Generate minimal documentation for empty repository
        if (options?.fromGithub) {
          const { username, reponame } = parseGithubUrl(options.fromGithub);
          yield `Repository: ${username}/${reponame}\n`;
          yield 'Status: Empty or minimal content\n';
        } else {
          const currentDir = process.cwd().split('/').pop() || 'current directory';
          yield `Repository: ${currentDir}\n`;
          yield 'Status: Empty or minimal content\n';
        }

        yield '\nRecommendation: Add more code files to generate comprehensive documentation.\n';
        return;
      }

      // If provider is explicitly specified, try only that provider
      if (options?.provider) {
        const providerInfo = getAllProviders().find((p) => p.provider === options.provider);
        if (!providerInfo?.available) {
          throw new ApiKeyMissingError(options.provider);
        }
        yield* this.tryProvider(options.provider, query, repoContext, options);
        return;
      }

      const providerName = options?.provider || this.config.doc?.provider || 'openai';
      const model =
        options?.model ||
        this.config.doc?.model ||
        (this.config as Record<string, any>)[providerName]?.model ||
        getDefaultModel(providerName);

      if (!model) {
        throw new ModelNotFoundError(providerName);
      }

      // Otherwise try providers in preference order
      let currentProvider = getNextAvailableProvider('doc');
      if (!currentProvider) {
        throw new ApiKeyMissingError('AI');
      }

      while (currentProvider) {
        try {
          yield* this.tryProvider(currentProvider, query, repoContext, options);
          return; // If successful, we're done
        } catch (error) {
          console.error(
            `Provider ${currentProvider} failed:`,
            error instanceof Error ? error.message : error
          );
          yield `Provider ${currentProvider} failed, trying next available provider...\n`;
          currentProvider = getNextAvailableProvider('doc', currentProvider);
        }
      }

      // If we get here, no providers worked
      throw new ProviderError(
        'No suitable AI provider available for doc command. Please ensure at least one of the following API keys are set in your ~/.vibe-tools/.env file: GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, PERPLEXITY_API_KEY, MODELBOX_API_KEY.'
      );
    } catch (error) {
      // Format and yield error message
      if (error instanceof CursorToolsError) {
        const errorMessage = error.formatUserMessage(options?.debug);
        console.error('Error in doc command:', errorMessage);
        yield `\n❌ Error: ${errorMessage}\n`;

        if (error instanceof ApiKeyMissingError) {
          yield `\nPlease set up the required API keys in your ~/.vibe-tools/.env file.\n`;
          yield `For more information, visit: https://github.com/cursor-ai/vibe-tools#api-keys\n`;
        }
      } else if (error instanceof Error) {
        console.error('Error in doc command:', error.message);
        yield `\n❌ Error: ${error.message}\n`;

        if (options?.debug && error.stack) {
          console.error(error.stack);
        }
      } else {
        console.error('An unknown error occurred in doc command:', error);
        yield `\n❌ Error: An unknown error occurred in the doc command.\n`;
      }

      // Always throw the error to terminate the generator
      throw error;
    }
  }

  /**
   * Validates that at least one required API key is available for the doc command
   * @param options Command options
   * @throws ApiKeyMissingError if no required API keys are found
   */
  private validateApiKeys(options: DocCommandOptions): void {
    // If a specific provider is requested, validate just that provider
    if (options?.provider) {
      const providerInfo = getAllProviders().find((p) => p.provider === options.provider);
      if (!providerInfo?.available) {
        throw new ApiKeyMissingError(options.provider);
      }
      return;
    }

    // Check if any of the preferred providers for doc command are available
    const docProviders = PROVIDER_PREFERENCE.doc;
    const availableProviders = getAllProviders().filter((p) => p.available);

    // Check if any of the preferred providers are available
    const hasAvailableProvider = docProviders.some((provider) =>
      availableProviders.some((p) => p.provider === provider)
    );

    if (!hasAvailableProvider) {
      // No providers available, throw error with list of required API keys
      throw new ProviderError(
        `No available providers for doc command`,
        `Run vibe-tools install and provide an API key for one of these providers: ${docProviders.join(', ')}`
      );
    }
  }

  private async *tryProvider(
    provider: Provider,
    query: string,
    repoContext: { text: string; tokenCount: number },
    options: DocCommandOptions
  ): CommandGenerator {
    const modelProvider = createProvider(provider);
    const model =
      options?.model ||
      this.config.doc?.model ||
      (this.config as Record<string, any>)[provider]?.model ||
      getDefaultModel(provider);

    if (!model) {
      throw new ProviderError(`No model specified for ${provider}`);
    }

    console.error(`Generating documentation using ${model}...\n`);

    const maxTokens =
      options?.maxTokens ||
      this.config.doc?.maxTokens ||
      (this.config as Record<string, any>)[provider]?.maxTokens ||
      defaultMaxTokens;

    try {
      const response = await generateDocumentation(query, modelProvider, repoContext, {
        ...options,
        model,
        maxTokens,
      });

      yield '\n--- Repository Documentation ---\n\n';
      yield response;
      yield '\n\n--- End of Documentation ---\n';

      console.error('Documentation generation completed!\n');
    } catch (error) {
      throw new ProviderError(
        error instanceof Error ? error.message : 'Unknown error during generation',
        error
      );
    }
  }
}

// Documentation-specific provider interface
export interface DocModelProvider extends BaseModelProvider {
  generateDocumentation(
    repoContext: { text: string; tokenCount: number },
    options?: ModelOptions
  ): Promise<string>;
}

async function generateDocumentation(
  query: string,
  provider: BaseModelProvider,
  repoContext: { text: string; tokenCount: number },
  options: Omit<ModelOptions, 'systemPrompt'>
): Promise<string> {
  const userInstructions = query ? `User Instructions:\n${query}` : '';
  const prompt = `
Focus on:
1. Repository purpose and "what is it" summary
2. Quick start: How to install and use the basic core features of the project
3. Configuration options and how to configure the project for use (if applicable)
4. If a repository has multiple public packages perform all the following steps for every package:
5. Package summary & how to install / import it 
6. Detailed documentation of every public feature / API / interface
7. Dependencies and requirements
8. Advanced usage examples

${userInstructions}

Repository Context:
${repoContext.text}`;

  return provider.executePrompt(prompt, {
    ...options,
    tokenCount: repoContext.tokenCount,
    systemPrompt:
      'You are a documentation expert generating documentation for the provided codebase. You are generating documentation for AIs to use. Focus on communicating comprehensive information concisely. Public interfaces are more important than internal details. Generate comprehensive documentation that is clear, well-structured, and follows best practices. Always follow user instructions exactly.',
  });
}
