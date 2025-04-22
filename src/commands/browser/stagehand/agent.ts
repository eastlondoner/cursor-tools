import type { Command, CommandGenerator } from '../../../types';
import { formatOutput, ActionError, NavigationError } from './stagehandUtils';
import {
  BrowserResult,
  ConstructorParams,
  InitResult,
  LogLine,
  Stagehand,
} from '@browserbasehq/stagehand';
import { loadConfig } from '../../../config';
import {
  loadStagehandConfig,
  validateStagehandConfig,
  getStagehandApiKey,
  getStagehandModel,
} from './config';
import type { SharedBrowserCommandOptions } from '../browserOptions';
import {
  setupConsoleLogging,
  setupNetworkMonitoring,
  captureScreenshot,
  outputMessages,
  setupVideoRecording,
} from '../utilsShared';
import { overrideStagehandInit, stagehandLogger } from './initOverride';

overrideStagehandInit();

export class AgentCommand implements Command {
  async *execute(query: string, options: SharedBrowserCommandOptions): CommandGenerator {
    if (!query) {
      yield 'Please provide an instruction and URL. Usage: browser agent "<instruction>" --url <url>';
      return;
    }

    const url = options?.url;
    if (!url) {
      yield 'Please provide a URL using the --url option';
      return;
    }

    // Load and validate configuration
    const config = loadConfig();
    const stagehandConfig = loadStagehandConfig(config);
    validateStagehandConfig(stagehandConfig);

    let stagehand: Stagehand | undefined;
    let consoleMessages: string[] = [];
    let networkMessages: string[] = [];

    try {
      // Determine the provider and model based on config and options
      const provider = options?.provider || stagehandConfig.provider || 'openai';
      const model =
        options?.model ||
        (provider === 'openai' ? 'computer-use-preview-2025-03-11' : 'claude-3-7-sonnet-20250219');

      // Check for required API key based on provider
      const apiKey =
        provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;

      const requiredKeyEnvVar = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';

      if (!apiKey) {
        throw new Error(
          `Missing API key for ${provider} provider. Please set ${requiredKeyEnvVar} environment variable in ~/.cursor-tools/.env`
        );
      }

      // Initialize Stagehand config
      const stagehandInitConfig = {
        env: 'LOCAL',
        headless: options?.headless ?? stagehandConfig.headless,
        verbose: options?.debug || stagehandConfig.verbose ? 1 : 0,
        debugDom: options?.debug ?? stagehandConfig.debugDom,
        modelName: getStagehandModel(stagehandConfig, {
          model: options?.model,
        }),
        apiKey: getStagehandApiKey(stagehandConfig),
        enableCaching: stagehandConfig.enableCaching,
        logger: stagehandLogger(options?.debug ?? stagehandConfig.verbose),
      } satisfies ConstructorParams;

      // Set default values for network and console options
      options = {
        ...options,
        network: options?.network === undefined ? true : options.network,
        console: options?.console === undefined ? true : options.console,
      };

      if (options?.debug) {
        console.log('using stagehand config', { ...stagehandInitConfig, apiKey: 'REDACTED' });
      }
      stagehand = new Stagehand(stagehandInitConfig);

      // Get timeouts from options or config
      const initTimeoutMs = options?.timeout ?? stagehandConfig.timeout ?? 30000;
      const navigationTimeoutMs = options?.timeout ?? stagehandConfig.timeout ?? 30000;
      const executionTimeoutMs = options?.timeout ?? stagehandConfig.timeout ?? 120000;

      // Handle proper resource cleanup
      await using _stagehand = {
        [Symbol.asyncDispose]: async () => {
          console.error('closing stagehand, this can take a while');
          await Promise.race([
            options?.connectTo ? undefined : stagehand?.page.close(),
            stagehand?.close(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Page close timeout')), 5000)
            ),
          ]);
          console.error('stagehand closed');
        },
      };

      // Initialize with timeout and video recording if requested
      const initPromise = stagehand.init({
        ...options,
        //@ts-ignore
        recordVideo: options.video
          ? {
              dir: await setupVideoRecording(options),
            }
          : undefined,
      });
      const initTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Initialization timeout')), initTimeoutMs)
      );
      await Promise.race([initPromise, initTimeoutPromise]);

      // Setup console and network monitoring
      consoleMessages = await setupConsoleLogging(stagehand.page, options || {});
      networkMessages = await setupNetworkMonitoring(stagehand.page, options || {});

      try {
        // Handle URL navigation with the same logic as act command
        if (url !== 'current') {
          const currentUrl = await stagehand.page.url();
          if (currentUrl !== url) {
            const gotoPromise = stagehand.page.goto(url);
            const gotoTimeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Navigation timeout')), navigationTimeoutMs)
            );
            await Promise.race([gotoPromise, gotoTimeoutPromise]);
          } else {
            console.log('Skipping navigation - already on correct page');
          }
        } else {
          console.log('Skipping navigation - using current page');
        }
      } catch (error) {
        throw new NavigationError(
          `Failed to navigate to ${url}. Please check if the URL is correct and accessible.`,
          error
        );
      }

      // Execute JS if provided
      if (options?.evaluate) {
        await stagehand.page.evaluate(options.evaluate);
      }

      const result = await this.executeAgentTask(
        stagehand,
        query,
        provider as 'openai' | 'anthropic',
        model,
        apiKey,
        executionTimeoutMs
      );

      // Take screenshot if requested
      await captureScreenshot(stagehand.page, options);

      // Format and output result
      yield formatOutput(result, options?.debug);
      for (const message of outputMessages(consoleMessages, networkMessages, options)) {
        yield message;
      }

      // Output HTML content if requested
      if (options?.html) {
        const htmlContent = await stagehand.page.content();
        yield '\n--- Page HTML Content ---\n\n';
        yield htmlContent;
        yield '\n--- End of HTML Content ---\n';
      }

      if (options?.screenshot) {
        yield `Screenshot saved to ${options.screenshot}\n`;
      }
    } catch (error) {
      console.error('error in stagehand agent execution', error);
      throw error;
    }
  }

  private async executeAgentTask(
    stagehand: Stagehand,
    instruction: string,
    provider: 'openai' | 'anthropic',
    model: string,
    apiKey: string,
    timeout = 120000
  ): Promise<any> {
    try {
      console.log(`Creating Stagehand agent [provider: ${provider}, model: ${model}]...`);

      // Create the agent
      const agent = stagehand.agent({
        provider,
        model,
        options: { apiKey },
        instructions: `You are a browser automation agent currently on: ${stagehand.page.url()}. Do not ask follow up questions; execute instructions directly.`,
      });

      // Execute the agent task with timeout
      console.log('Executing agent task...');
      let totalTimeout: ReturnType<typeof setTimeout> | undefined;
      const totalTimeoutPromise = new Promise(
        (_, reject) =>
          (totalTimeout = setTimeout(() => reject(new Error('Agent execution timeout')), timeout))
      );

      const agentResult = await Promise.race([agent.execute(instruction), totalTimeoutPromise]);

      if (totalTimeout) {
        clearTimeout(totalTimeout);
      }

      return agentResult;
    } catch (error) {
      console.error('error in stagehand agent task', error);
      if (error instanceof Error) {
        throw new ActionError(`Failed to execute agent task: ${instruction}`, {
          instruction,
          error,
        });
      }
      throw error;
    }
  }
}
