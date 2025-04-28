import type { Command, CommandGenerator, CommandOptions, Config, Provider } from '../types';
import { defaultMaxTokens, loadConfig, loadEnv } from '../config';
import { pack } from 'repomix';
import { readFileSync } from 'node:fs';
import type { ModelOptions, BaseModelProvider } from '../providers/base';
import { createProvider } from '../providers/base';
import { FileError, ProviderError } from '../errors';
import { loadFileConfigWithOverrides } from '../repomix/repomixConfig';
import { fetchDocContent } from '../utils/fetch-doc.ts';

const FIVE_MINUTES = 300000;
const TEN_MINUTES = 600000;

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
  withDoc?: string[];
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
  gemini: 'gemini-2.5-pro-exp-03-25',
  openai: 'o3-mini',
  perplexity: 'r1-1776',
  openrouter: 'openai/o3-mini',
  modelbox: 'anthropic/claude-3-7-sonnet-thinking',
  anthropic: 'claude-3-7-sonnet-latest',
};

// Helper function to infer provider from model name
function inferProviderFromModel(modelName: string): FileProvider | undefined {
  if (!modelName) return undefined;

  // Convert to lowercase for case-insensitive comparison
  const model = modelName.toLowerCase();

  // Check for model name patterns and return provider only if API key is available

  // Check for Gemini
  if (model.includes('gemini') || model.startsWith('google/')) {
    // Return Gemini only if API key is available
    if (process.env.GEMINI_API_KEY) {
      return 'gemini';
    }
  }
  // Check for OpenAI
  else if (model.includes('gpt') || model.includes('o3-') || model.startsWith('openai/')) {
    if (process.env.OPENAI_API_KEY) {
      return 'openai';
    }
  }
  // Check for Anthropic
  else if (model.includes('claude') || model.startsWith('anthropic/')) {
    if (process.env.ANTHROPIC_API_KEY) {
      return 'anthropic';
    }
  }
  // Check for Perplexity
  else if (
    model.includes('sonar') ||
    model.includes('mixtral') ||
    model.includes('mistral') ||
    model.startsWith('perplexity/')
  ) {
    if (process.env.PERPLEXITY_API_KEY) {
      return 'perplexity';
    }
  }
  // Check for models with provider prefixes (like OpenRouter or ModelBox)
  else if (model.includes('/')) {
    const providerPrefix = model.split('/')[0].toLowerCase();
    if (providerPrefix === 'google' && process.env.GEMINI_API_KEY) return 'gemini';
    if (providerPrefix === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
    if (providerPrefix === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
    if (providerPrefix === 'perplexity' && process.env.PERPLEXITY_API_KEY) return 'perplexity';
  }

  // If we couldn't match with a provider that has API keys, try OpenRouter or ModelBox as fallbacks
  if (process.env.OPENROUTER_API_KEY) {
    return 'openrouter';
  } else if (process.env.MODELBOX_API_KEY) {
    return 'modelbox';
  }

  return undefined;
}

export class PlanCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  async *execute(query: string, options: PlanCommandOptions): CommandGenerator {
    yield `Executing plan command with query: ${query}`;

    try {
      // Check for conflicting model options
      if (options?.model && options?.thinkingModel) {
        throw new Error(
          'Cannot specify both --model and --thinkingModel options. Use --model to set the thinking model.'
        );
      }

      // If user provided fileModel without fileProvider, try to infer the provider
      const inferredFileModelProvider =
        options?.fileModel && !options?.fileProvider
          ? inferProviderFromModel(options.fileModel)
          : undefined;

      // If user provided thinkingModel without thinkingProvider, try to infer the provider
      const inferredThinkingModelProvider =
        (options?.thinkingModel || options?.model) &&
        !(options?.provider || options?.thinkingProvider)
          ? inferProviderFromModel(options?.thinkingModel || (options?.model as string))
          : undefined;

      // Select file provider with inference fallback and respect configuration
      const fileProviderName =
        options?.fileProvider || // 1. Explicit fileProvider option
        inferredFileModelProvider || // 2. Inferred from fileModel option
        this.config.plan?.fileProvider || // 3. Configured default fileProvider
        'gemini'; // 4. Overall default

      let fileProvider;
      try {
        fileProvider = createProvider(fileProviderName);
      } catch (error) {
        console.error(`Failed to initialize file provider ${fileProviderName}`, error);
        throw new ProviderError(
          `Failed to initialize file provider ${fileProviderName}. Please check your API keys or try a different provider.`,
          error
        );
      }

      // Select thinking provider with inference fallback and respect configuration
      const thinkingProviderName =
        options?.thinkingProvider || // 1. Explicit thinkingProvider option
        inferredThinkingModelProvider || // 2. Inferred from thinkingModel/model option
        this.config.plan?.thinkingProvider || // 3. Configured default thinkingProvider
        fileProviderName || // 4. Fallback to the selected fileProviderName
        'openai'; // 5. Overall default

      let thinkingProvider;
      try {
        thinkingProvider = createProvider(thinkingProviderName);
      } catch (error) {
        console.error(`Failed to initialize thinking provider ${thinkingProviderName}`, error);
        throw new ProviderError(
          `Failed to initialize thinking provider ${thinkingProviderName}. Please check your API keys or try a different provider.`,
          error
        );
      }

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

      yield 'Finding relevant files...\\n';

      // Get file listing
      let packedRepo: string;
      try {
        yield 'Running repomix to get file listing...\\n';

        const repomixDirectory = process.cwd();
        const tempFile = '.repomix-plan-files.txt';
        const repomixConfig = await loadFileConfigWithOverrides(repomixDirectory, {
          output: {
            filePath: tempFile,
          },
        });
        const repomixResult = await pack([repomixDirectory], repomixConfig);

        if (options?.debug) {
          yield 'Repomix completed successfully.\\n';
        }

        // TODO: this seems like an expensive way to get a list of files
        packedRepo = readFileSync(tempFile, 'utf-8');

        yield `Found ${repomixResult.totalFiles} files, approx ${repomixResult.totalTokens} tokens.\\n`;
        if (options?.debug) {
          yield 'First few files:\\n';
          yield `${packedRepo.split('\\n').slice(0, 5).join('\\n')}\\n\\n`;
          yield 'File listing format check:\\n';
          yield `First 200 characters: ${JSON.stringify(packedRepo.slice(0, 200))}\\n`;
          yield `Last 200 characters: ${JSON.stringify(packedRepo.slice(-200))}\\n\\n`;
        }
      } catch (error) {
        throw new FileError('Failed to get file listing', error);
      }

      // Fetch document content if the flag is provided
      let docContent = '';
      if (options?.withDoc && Array.isArray(options.withDoc) && options.withDoc.length > 0) {
        try {
          const urls = options.withDoc;
          yield `Fetching document content from ${urls.length} URLs: ${urls.join(', ')}...\\n`;
          docContent = await fetchDocContent(urls, options.debug ?? false);
          yield `Successfully fetched combined document content.\\n`;
        } catch (error) {
          const urls = options.withDoc;
          console.error(
            `Error fetching document content from one or more URLs: ${urls.join(', ')}`,
            error
          );
          yield `Warning: Failed to fetch document content from one or more URLs (${urls.join(', ')}). Continuing analysis without it. Error: ${error instanceof Error ? error.message : String(error)}\\n`;
        }
      } else if (options?.withDoc) {
        console.warn(
          '--with-doc was provided but not as a non-empty array of URLs. Proceeding without document context.'
        );
      }

      // Get relevant files
      let filePaths: string[];
      try {
        const maxTokens =
          options?.maxTokens ||
          (this.config as Record<string, any>)[fileProviderName]?.maxTokens ||
          defaultMaxTokens;

        // Pass docContent to getRelevantFiles
        filePaths = await getRelevantFiles(
          fileProvider,
          query,
          packedRepo,
          {
            model: fileModel,
            maxTokens,
            debug: options?.debug,
            reasoningEffort: options?.reasoningEffort ?? this.config.reasoningEffort,
          },
          docContent // Pass fetched content here
        );

        yield `Relevant files identified: ${filePaths.join(', ')}\\n`;
      } catch (error) {
        throw new ProviderError('Failed to get relevant files', error);
      }

      if (filePaths.length === 0) {
        yield 'No relevant files found. Please refine your query.\\n';
        return;
      }

      yield `Found ${filePaths.length} relevant files:\\n${filePaths.join('\\n')}\\n\\n`;

      yield 'Extracting content from relevant files...\\n';
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
          yield 'Content extraction completed.\\n';
          yield `Extracted content size: ${filteredResult.totalTokens} tokens\\n`;
        }

        filteredContent = readFileSync(tempFile, 'utf-8');
      } catch (error) {
        throw new FileError('Failed to extract content', error);
      }

      const thinkingMaxTokens =
        options?.maxTokens ||
        this.config.plan?.thinkingMaxTokens ||
        (this.config as Record<string, any>)[thinkingProviderName]?.maxTokens ||
        defaultMaxTokens;

      const effectiveThinkingMaxTokens = thinkingMaxTokens ?? defaultMaxTokens; // Ensure maxTokens is a number

      // Explicitly create a full ModelOptions object
      const thinkingModelOptions: ModelOptions = {
        model: thinkingModel,
        maxTokens: effectiveThinkingMaxTokens,
        debug: options?.debug,
        // Initialize other potential optional ModelOptions fields if necessary
      };

      yield `Generating plan using ${thinkingProviderName} with max tokens: ${effectiveThinkingMaxTokens}...\\n`;
      let plan: string;
      try {
        plan = await generatePlan(
          thinkingProvider,
          query,
          filteredContent,
          thinkingModelOptions, // Pass the fully typed object
          docContent
        );
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

// Pure functions for plan operations
async function getRelevantFiles(
  provider: BaseModelProvider,
  query: string,
  packedRepo: string,
  options: ModelOptions, // Expect full ModelOptions
  docContent: string
): Promise<string[]> {
  let systemPrompt = `You are an AI assistant helping a developer find relevant files in a codebase based on their request. Your task is to identify the most relevant files from the provided list based on the user's query.\nReturn ONLY a comma-separated list of the full file paths. Do not include any other text, explanation, or formatting.`;

  if (docContent) {
    systemPrompt += `\n\nConsider the following external document context when identifying relevant files:\n\n--- Document Context ---\n${docContent}\n--- End Document Context ---`;
  }

  const prompt = `User Query: ${query}\n\nFull list of files in the repository:\n\`\`\`\n${packedRepo}\n\`\`\`\n\nPlease return the comma-separated list of file paths most relevant to the user query.`;

  const result = await provider.executePrompt(prompt, { ...options, systemPrompt });
  return parseFileList(result);
}

/**
 * Generates an implementation plan using the thinking provider.
 */
async function generatePlan(
  provider: BaseModelProvider,
  query: string,
  filteredContent: string,
  options: ModelOptions, // Expect full ModelOptions
  docContent: string
): Promise<string> {
  let systemPrompt = `You are an AI assistant tasked with creating a detailed, step-by-step implementation plan based on a user's request and relevant code context.\nThe plan should be clear, actionable, and formatted in Markdown.\nFocus on providing specific file modifications, code snippets (where appropriate), and necessary commands.\nAssume the user is an experienced developer.\nReturn ONLY the Markdown plan.`;

  if (docContent) {
    systemPrompt += `\n\nConsider the following external document context when generating the plan:\n\n--- Document Context ---\n${docContent}\n--- End Document Context ---`;
  }

  const prompt = `User Query: ${query}\n\nRelevant Code Context:\n\`\`\`\n${filteredContent}\n\`\`\`\n\nPlease generate the implementation plan.`;

  return provider.executePrompt(prompt, { ...options, systemPrompt });
}
