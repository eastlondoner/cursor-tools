import type { Command, CommandGenerator } from '../../../types';
import {
  formatOutput,
  handleBrowserError,
  ExtractionSchemaError,
  NavigationError,
} from './stagehandUtils';
import { ConstructorParams, Stagehand } from '@browserbasehq/stagehand';
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
import { stagehandLogger } from './initOverride';
import { overrideStagehandInit } from './initOverride';

overrideStagehandInit();

export class ExtractCommand implements Command {
  async *execute(query: string, options: SharedBrowserCommandOptions): CommandGenerator {
    if (!query) {
      yield 'Please provide an instruction and URL. Usage: browser extract "<instruction>" --url <url>';
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
      const videoDir = await setupVideoRecording(options);
      const config = {
        env: 'LOCAL',
        localBrowserLaunchOptions: {
          headless: options?.headless ?? stagehandConfig.headless,
          recordVideo:
            options?.video && videoDir
              ? {
                  dir: videoDir,
                }
              : undefined,
        },
        verbose: options?.debug || stagehandConfig.verbose ? 1 : 0,
        modelName: getStagehandModel(stagehandConfig, {
          model: options?.model,
        }) as 'claude-3-7-sonnet-20250219',
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
        console.log('using stagehand config', { ...config, apiKey: 'REDACTED' });
      }
      stagehand = new Stagehand(config);

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

      // Initialize with timeout
      const initPromise = stagehand.init();
      const initTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Initialization timeout')), 30000)
      );
      await Promise.race([initPromise, initTimeoutPromise]);

      // Setup console and network monitoring
      consoleMessages = await setupConsoleLogging(stagehand.page, options);
      networkMessages = await setupNetworkMonitoring(stagehand.page, options);

      try {
        // Skip navigation if url is 'current' or if current URL matches target URL
        if (url !== 'current') {
          const currentUrl = await stagehand.page.url();
          if (currentUrl !== url) {
            // Navigate with timeout
            const gotoPromise = stagehand.page.goto(url);
            const gotoTimeoutPromise = new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Navigation timeout')),
                stagehandConfig.timeout ?? 30000
              )
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

      const result = await this.performExtraction(
        stagehand,
        { instruction: query, evaluate: options?.evaluate },
        options?.timeout ?? stagehandConfig.timeout
      );

      // Take screenshot if requested
      await captureScreenshot(stagehand.page, options);

      // Output result and messages
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
      yield handleBrowserError(error, options?.debug);
    }
  }

  private async performExtraction(
    stagehand: Stagehand,
    {
      instruction,
      evaluate,
    }: {
      instruction: string;
      evaluate?: string;
    },
    timeout = 120000
  ): Promise<unknown> {
    try {
      let totalTimeout: ReturnType<typeof setTimeout> | undefined;
      const totalTimeoutPromise = new Promise(
        (_, reject) =>
          (totalTimeout = setTimeout(() => reject(new Error('Extraction timeout')), timeout))
      );

      if (evaluate) {
        await Promise.race([stagehand.page.evaluate(evaluate), totalTimeoutPromise]);
      }

      // Perform extraction with timeout
      const extractionPromise = stagehand.page.extract(instruction);
      const result = await Promise.race([extractionPromise, totalTimeoutPromise]);

      if (totalTimeout) {
        clearTimeout(totalTimeout);
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new ExtractionSchemaError(`${error.message} Failed to extract data: ${instruction}`, {
          instruction,
          error,
          pageContent: await stagehand.page.content(),
        });
      }
      throw error;
    }
  }
}
