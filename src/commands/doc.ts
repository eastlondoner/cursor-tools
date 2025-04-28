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
  getProviderInfo,
  isProviderAvailable,
  getDefaultModel,
  PROVIDER_PREFERENCE,
  getAvailableProviders,
} from '../utils/providerAvailability';
import { getGithubRepoContext, looksLikeGithubRepo, parseGithubUrl } from '../utils/githubRepo';
import { fetchDocContent } from '../utils/fetch-doc.ts';

export class DocCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  async *execute(query: string, options: CommandOptions): CommandGenerator {
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

      this.validateApiKeys(options);

      let repoContext: { text: string; tokenCount: number };

      let finalQuery = options.hint || '';

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
          yield `Warning: Failed to fetch document content from one or more URLs (${urls.join(', ')}). Continuing documentation generation without it. Error: ${error instanceof Error ? error.message : String(error)}\n`;
        }
      } else if (options?.withDoc) {
        console.warn(
          '--with-doc was provided but not as a non-empty array of URLs. Proceeding without document context.'
        );
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
            console.error('Error reading repository context:', error);
            throw new FileError('Failed to read repository context', error);
          }
        } catch (error) {
          console.error('Error packing repository:', error);
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

      const availableProvidersList = getAvailableProviders()
        .map((p) => p.provider)
        .join(', ');

      // If provider is explicitly specified, try only that provider
      if (options?.provider) {
        const providerInfo = getProviderInfo(options.provider);
        if (!providerInfo) {
          throw new ProviderError(
            `Unrecognized provider: ${options.provider}.`,
            `Try one of ${availableProvidersList}`
          );
        } else if (!providerInfo.available) {
          throw new ApiKeyMissingError(options.provider);
        }
        yield* this.tryProvider(options.provider, finalQuery, repoContext, options, docContent);
        return;
      }

      let currentProvider = null;

      const noAvailableProvidersMsg =
        'No suitable AI provider available for doc command. Please ensure at least one of the following API keys are set in your ~/.cursor-tools/.env file: GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, PERPLEXITY_API_KEY, MODELBOX_API_KEY.';

      if (this.config.doc?.provider && isProviderAvailable(this.config.doc?.provider)) {
        currentProvider = this.config.doc.provider;
      }

      if (!currentProvider) {
        currentProvider = getNextAvailableProvider('doc');
      }

      if (!currentProvider) {
        throw new ProviderError(noAvailableProvidersMsg);
      }

      while (currentProvider) {
        try {
          yield* this.tryProvider(currentProvider, finalQuery, repoContext, options, docContent);
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

      // If we get here, no providers worked
      throw new ProviderError(noAvailableProvidersMsg);
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

  private validateApiKeys(options: CommandOptions): void {
    if (options?.provider) {
      if (!isProviderAvailable(options.provider)) {
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
    options: CommandOptions,
    docContent: string
  ): CommandGenerator {
    console.log(`Trying provider: ${provider}`);
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
      const modelOptsForGeneration: Omit<ModelOptions, 'systemPrompt'> & { model: string } = {
        ...options,
        model,
        maxTokens,
        debug: options.debug,
        tokenCount: options.tokenCount ?? repoContext.tokenCount,
      };

      const documentation = await generateDocumentation(
        query,
        modelProvider,
        repoContext,
        modelOptsForGeneration,
        docContent
      );
      yield '\n--- Repository Documentation ---\n\n';
      yield documentation;
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
  options: Omit<ModelOptions, 'systemPrompt'> & { model: string },
  docContent: string
): Promise<string> {
  let systemPrompt = `You are an expert AI assistant specializing in generating comprehensive and accurate technical documentation for software repositories.\nYour goal is to create a well-structured Markdown document that explains the repository's purpose, structure, key components, setup, usage, and best practices.\nAnalyze the provided repository content and generate documentation based *only* on that content.\nDo not invent features or functionality not present in the code.\nStructure the output clearly using Markdown headings, lists, and code blocks.\nFocus on clarity, accuracy, and completeness based on the given context.`;

  if (query) {
    systemPrompt += `\n\nThe user has provided the following hint or specific focus for the documentation: ${query}`;
  }

  if (docContent) {
    systemPrompt += `\n\nAdditionally, consider the following external document content when generating the documentation:\n\n--- Document Context ---\n${docContent}\n--- End Document Context ---`;
  }

  const prompt = `Repository Content:\n\`\`\`\n${repoContext.text}\n\`\`\`\n\nPlease generate the repository documentation based on the instructions and the provided content.`;

  try {
    const result = await provider.executePrompt(prompt, {
      ...options,
      systemPrompt,
    });
    return result;
  } catch (error) {
    if (error instanceof ModelNotFoundError) {
      throw new ModelNotFoundError(error.model, provider.providerName);
    } else if (error instanceof Error) {
      throw new ProviderError(
        `Error generating documentation with ${provider.providerName}: ${error.message}`,
        error
      );
    } else {
      throw new ProviderError(
        `Unknown error generating documentation with ${provider.providerName}`,
        error
      );
    }
  }
}
