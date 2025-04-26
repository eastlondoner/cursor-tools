import type { Command, CommandGenerator } from '../../../types';
import {
  formatOutput,
  handleBrowserError,
  ObservationError,
  NavigationError,
} from './stagehandUtils';
import { ConstructorParams, Stagehand, ObserveResult } from '@browserbasehq/stagehand';
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

interface ObservationResult {
  elements: Array<{
    type: string;
    description: string;
    actions: string[];
    location: string;
  }>;
  summary: string;
}

export class ObserveCommand implements Command {
  async *execute(query: string, options: SharedBrowserCommandOptions): CommandGenerator {
    if (!query) {
      yield 'Please provide an instruction and URL. Usage: browser observe "<instruction>" --url <url>';
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

    const videoDir = await setupVideoRecording(options);
    try {
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
          console.log('stagehand closed');
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
        if (options.url && options.url !== 'current') {
          const currentUrl = await stagehand.page.url();
          if (currentUrl !== options.url) {
            // Navigate with timeout
            const gotoPromise = stagehand.page.goto(options.url);
            const gotoTimeoutPromise = new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Navigation timeout')),
                stagehandConfig.timeout ?? 30000
              )
            );
            await Promise.race([gotoPromise, gotoTimeoutPromise]);
          } else {
            if (options?.debug) {
              console.log('Skipping navigation - already on correct page');
            }
          }
        } else {
          if (options?.debug) {
            console.log('Skipping navigation - using current page');
          }
        }

        // Execute custom JavaScript if provided
        if (options?.evaluate) {
          await stagehand.page.evaluate(options.evaluate);
        }
      } catch (error) {
        throw new NavigationError(
          `Failed to navigate to ${options.url}. Please check if the URL is correct and accessible.`,
          error
        );
      }

      // Use Stagehand's native observe method
      const result = await this.performObservation(
        stagehand,
        query,
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
      console.error(error);
      yield handleBrowserError(error, options?.debug);
    }
  }

  private async performObservation(
    stagehand: Stagehand,
    instruction?: string,
    timeout = 30000
  ): Promise<ObservationResult> {
    try {
      const timeoutPromise = new Promise<ObserveResult[]>((_, reject) =>
        setTimeout(() => reject(new Error('Observation timeout')), timeout)
      );

      const observeOptions = {
        instruction: instruction || 'Find interactive elements on this page',
        onlyVisible: true,
        timeout: Math.min(timeout, 5000), // Use a shorter timeout for DOM settling
      };

      const observations = await Promise.race([
        stagehand.page.observe(observeOptions),
        timeoutPromise,
      ]);

      if (!observations || observations.length === 0) {
        throw new ObservationError('No interactive elements found on the page', {
          instruction,
          pageContent: await stagehand.page.content(),
        });
      }

      // Deduplicate elements by selector
      const uniqueObservations = observations.reduce((acc, obs) => {
        if (!acc.has(obs.selector)) {
          acc.set(obs.selector, obs);
        }
        return acc;
      }, new Map<string, ObserveResult>());

      // Helper to determine element type and actions
      const getTypeAndActions = async (obs: ObserveResult) => {
        const element = await stagehand.page.$(obs.selector);
        if (!element) return { type: 'unknown', actions: ['click'] };

        const tagName = await element.evaluate((el) => el.tagName.toLowerCase());
        const type = await element.evaluate((el) => el.getAttribute('type')?.toLowerCase());
        const role = await element.evaluate((el) => el.getAttribute('role')?.toLowerCase());

        let elementType = tagName;
        let actions: string[] = ['click'];

        if (tagName === 'input') {
          if (type === 'text' || type === 'email' || type === 'password') {
            actions = ['type', 'focus', 'blur'];
            elementType = `${type || 'text'} input`;
          } else if (type === 'checkbox' || type === 'radio') {
            actions = ['click', 'check'];
            elementType = type;
          }
        } else if (tagName === 'select') {
          actions = ['select'];
        } else if (tagName === 'textarea') {
          actions = ['type', 'focus', 'blur'];
        } else if (tagName === 'a') {
          actions = ['click', 'hover'];
          elementType = 'link';
        } else if (role === 'button' || tagName === 'button') {
          elementType = 'button';
        }

        return { type: elementType, actions };
      };

      const elements = await Promise.all(
        Array.from(uniqueObservations.values()).map(async (obs) => {
          const { type, actions } = await getTypeAndActions(obs);
          return {
            type,
            description: obs.description,
            actions,
            location: obs.selector,
          };
        })
      );

      return {
        elements,
        summary: `Found ${elements.length} unique interactive elements on the page`,
      };
    } catch (error) {
      if (error instanceof ObservationError) {
        throw error;
      }
      throw new ObservationError('Failed to observe elements on the page', {
        instruction,
        error,
        pageContent: await stagehand.page.content(),
      });
    }
  }
}
