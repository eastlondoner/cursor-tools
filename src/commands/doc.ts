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
import { fetchNotionPageContent } from '../utils/notion.ts';

interface DocCommandOptions extends CommandOptions {
  withNotion?: string;
  model?: ModelOptions['model'];
  maxTokens?: ModelOptions['maxTokens'];
  fromGithub?: string;
  hint?: string;
  debug: boolean;
  provider?: Provider;
  subdir?: string;
  tokenCount?: ModelOptions['tokenCount'];
  webSearch?: ModelOptions['webSearch'];
  timeout?: ModelOptions['timeout'];
  reasoningEffort?: ModelOptions['reasoningEffort'];
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

      if (query && !options?.fromGithub && looksLikeGithubRepo(query)) {
        options = { ...options, fromGithub: query };
      } else if (query) {
        options = {
          ...options,
          hint: options?.hint ? `${options.hint}\n\n${query}` : query,
        };
      }

      this.validateApiKeys(options);

      let repoContext: { text: string; tokenCount: number };

      let finalQuery = options.hint || '';

      let notionContent = '';
      if (options?.withNotion) {
        if (
          typeof options.withNotion !== 'string' ||
          !options.withNotion.startsWith('https://www.notion.so/')
        ) {
          throw new Error(
            'Invalid Notion URL provided with --with-notion. Must be a valid Notion page URL.'
          );
        }
        try {
          yield `Fetching Notion page content from ${options.withNotion}...\n`;
          notionContent = await fetchNotionPageContent(options.withNotion, options.debug ?? false);
          yield `Successfully fetched Notion content.\n`;
        } catch (error) {
          console.error('Error fetching Notion content:', error);
          yield `Warning: Failed to fetch Notion content from ${options.withNotion}. Continuing documentation generation without it. Error: ${error instanceof Error ? error.message : String(error)}\n`;
        }
      }

      if (options?.fromGithub) {
        console.error(`Fetching repository context for ${options.fromGithub}...\n`);

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

      if (repoContext.tokenCount > 200_000) {
        options = { ...options, tokenCount: repoContext.tokenCount };
      }

      const isEmptyRepo = repoContext.text.trim() === '' || repoContext.tokenCount < 50;
      if (isEmptyRepo) {
        console.error('Repository appears to be empty or contains minimal code.');
        yield '\n\n\u2139\uFE0F Repository Notice: This repository appears to be empty or contains minimal code.\n';
        yield 'Basic structure documentation:\n';

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

      if (options?.provider) {
        const providerInfo = getAllProviders().find((p) => p.provider === options.provider);
        if (!providerInfo?.available) {
          throw new ApiKeyMissingError(options.provider);
        }
        yield* this.tryProvider(options.provider, finalQuery, repoContext, options, notionContent);
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

      let currentProvider = getNextAvailableProvider('doc');
      if (!currentProvider) {
        throw new ApiKeyMissingError('AI');
      }

      while (currentProvider) {
        try {
          yield* this.tryProvider(currentProvider, finalQuery, repoContext, options, notionContent);
          return;
        } catch (error) {
          console.error(
            `Provider ${currentProvider} failed:`,
            error instanceof Error ? error.message : error
          );
          yield `Provider ${currentProvider} failed, trying next available provider...\n`;
          currentProvider = getNextAvailableProvider('doc', currentProvider);
        }
      }

      throw new ProviderError(
        'No suitable AI provider available for doc command. Please ensure at least one of the following API keys are set in your ~/.vibe-tools/.env file: GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, PERPLEXITY_API_KEY, MODELBOX_API_KEY.'
      );
    } catch (error) {
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

      throw error;
    }
  }

  private validateApiKeys(options: DocCommandOptions): void {
    if (options?.provider) {
      const providerInfo = getAllProviders().find((p) => p.provider === options.provider);
      if (!providerInfo?.available) {
        throw new ApiKeyMissingError(options.provider);
      }
      return;
    }

    const docProviders = PROVIDER_PREFERENCE.doc;
    const availableProviders = getAllProviders().filter((p) => p.available);

    const hasAvailableProvider = docProviders.some((provider) =>
      availableProviders.some((p) => p.provider === provider)
    );

    if (!hasAvailableProvider) {
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
    options: DocCommandOptions,
    notionContent: string
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
      const modelOptions: ModelOptions = {
        model,
        maxTokens,
        systemPrompt: 'dummy',
        debug: options.debug,
        tokenCount: options.tokenCount,
        webSearch: options.webSearch,
        timeout: options.timeout,
        reasoningEffort: options.reasoningEffort,
      };

      const response = await generateDocumentation(
        query,
        modelProvider,
        repoContext,
        modelOptions,
        notionContent
      );
      yield '\n--- Repository Documentation ---\n\n';
      yield response;
      yield '\n\n--- End of Documentation ---\n';

      console.error('Documentation generation completed!\n');
    } catch (error) {
      if (error instanceof ModelNotFoundError) {
        yield `Model ${model} not found for provider ${provider}. Please check the model name and your provider configuration.\n`;
        throw error;
      } else {
        throw new ProviderError(
          error instanceof Error ? error.message : 'Unknown error during documentation generation',
          error
        );
      }
    }
  }
}

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
  options: ModelOptions,
  notionContent: string
): Promise<string> {
  const notionContextString = notionContent
    ? `Context from Notion Page:\n--- START NOTION CONTENT ---\n${notionContent}\n--- END NOTION CONTENT ---\n\n`
    : '';

  const prompt = `${notionContextString}${repoContext.text}${query ? `\n\n${query}` : ''}`;

  const systemPrompt = `You are an expert technical writer generating documentation for a repository.${notionContent ? ' Additional context from a Notion page is provided.' : ''}
Analyze the following codebase context and generate comprehensive, well-structured documentation in Markdown format.
Focus on explaining the project structure, key components, functionality, and usage.
Include code examples where relevant.
${query ? 'Follow any specific instructions or hints provided by the user.' : ''}
Structure the documentation logically with clear headings and explanations.`;

  const finalOptions: ModelOptions = {
    ...options,
    systemPrompt,
  };

  return provider.executePrompt(prompt, finalOptions);
}
