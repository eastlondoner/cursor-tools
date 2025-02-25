import type { Command, CommandGenerator, CommandOptions } from '../types.ts';
import type { Config } from '../types.ts';
import { defaultMaxTokens, loadConfig, loadEnv } from '../config.ts';
import { createProvider } from '../providers/base';
import { ProviderError } from '../errors';

// Default models that support web search for each provider
const DEFAULT_WEB_MODELS = {
  perplexity: 'sonar-pro',
  openrouter: 'perplexity/sonar',
  modelbox: 'google/gemini-2.0-pro-exp',
  gemini: 'gemini-2.0-pro-exp',
} as const;

export class WebCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  getDescription(): string {
    return 'Get answers from the web using Perplexity AI';
  }

  getHelp(): string {
    return `Web Command - Get answers from the web using Perplexity AI

Usage: cursor-tools web "<query>" [options]

Options:
  --provider=<provider>    AI provider to use (perplexity, gemini, modelbox, or openrouter)
  --model=<model>         Model to use for web search (model name depends on provider)
  --max-tokens=<number>   Maximum tokens for response
  --save-to=<file path>   Save output to a file (in addition to stdout)

Examples:
  cursor-tools web "latest shadcn/ui installation instructions"
  cursor-tools web "current weather in London" --provider perplexity
  cursor-tools web "typescript best practices 2024" --save-to local-research/typescript.md

Notes:
- Uses Perplexity AI by default for web search
- Supports multiple providers with web search capabilities
- Can save complex research to files for later reference
- Streams results in real-time for immediate feedback

Dependencies:
- Requires API key for chosen provider in .cursor-tools.env`;
  }

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    try {
      const provider = options?.provider || this.config.web?.provider || 'perplexity';

      let model =
        options?.model ||
        this.config.web?.model ||
        (this.config as Record<string, any>)[provider]?.model ||
        DEFAULT_WEB_MODELS[provider as keyof typeof DEFAULT_WEB_MODELS];

      // Validate provider supports web search
      if (!model) {
        throw new ProviderError(
          `Provider ${provider} does not support web search. Please use one of: ${Object.keys(DEFAULT_WEB_MODELS).join(', ')}`
        );
      }

      // Check web search capability
      const modelProvider = createProvider(provider);
      const SAFETY_OVERRIDE = process.env.OVERRIDE_SAFETY_CHECKS?.toLowerCase();
      const isOverridden = SAFETY_OVERRIDE === 'true' || SAFETY_OVERRIDE === '1';

      const webSearchSupport = modelProvider.supportsWebSearch(model);
      if (!isOverridden && !webSearchSupport.supported) {
        if (webSearchSupport.model) {
          console.log(`Using ${webSearchSupport.model} instead of ${model} for web search`);
          model = webSearchSupport.model;
        } else {
          throw new ProviderError(
            `${webSearchSupport.error}\n\n` +
              `Please use one of these providers/models that support web search:\n` +
              `- Gemini (e.g. gemini-2.0-flash or gemini-2.0-pro-exp)\n` +
              `- Perplexity (e.g. sonar, sonar-pro, sonar-reasoning, sonar-reasoning-pro)\n` +
              `- OpenRouter (e.g. perplexity/sonar)\n` +
              `- ModelBox (e.g. perplexity/sonar)\n\n` +
              `Available default models:\n` +
              Object.entries(DEFAULT_WEB_MODELS)
                .map(([p, m]) => `- ${p}: ${m}`)
                .join('\n') +
              `\n\nOr set OVERRIDE_SAFETY_CHECKS=true to bypass this check (not recommended)`
          );
        }
      }

      if (
        isOverridden &&
        (!webSearchSupport.supported ||
          (webSearchSupport.model && model !== webSearchSupport.model))
      ) {
        console.log(
          `Warning: Web search compatibility check bypassed via OVERRIDE_SAFETY_CHECKS.\n` +
            `Using ${model} instead of ${webSearchSupport.model} for web search.\n` +
            `This may result in errors or unexpected behavior.`
        );
      }

      const maxTokens =
        options?.maxTokens ||
        this.config.web?.maxTokens ||
        (this.config as Record<string, any>)[provider]?.maxTokens ||
        defaultMaxTokens;

      yield `Querying ${provider} using ${model} for: ${query} with maxTokens: ${maxTokens}\n`;

      const response = await modelProvider.executePrompt(query, {
        model,
        maxTokens,
        debug: options.debug,
        webSearch: true,
        systemPrompt:
          "You are an expert software engineering assistant. Follow user instructions exactly and satisfy the user's request. Always Search the web for the latest information, even if you think you know the answer.",
      });

      yield response;
    } catch (error) {
      if (error instanceof Error) {
        yield `Error: ${error.message}`;
        if (options?.debug) {
          console.error('Detailed error:', error);
        }
      } else {
        yield 'An unknown error occurred';
        if (options?.debug) {
          console.error('Unknown error:', error);
        }
      }
    }
  }
}
