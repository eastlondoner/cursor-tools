import { Stagehand, ConstructorParams } from '@browserbasehq/stagehand';
import type { SharedBrowserCommandOptions } from '../browserOptions';
import { loadConfig } from '../../../config';
import {
  loadStagehandConfig,
  validateStagehandConfig,
  getStagehandApiKey,
  getStagehandModel,
} from './config';
import { overrideStagehandInit, stagehandLogger } from './initOverride';
import { setupVideoRecording } from '../utilsShared';
import { Page, BrowserContext } from 'playwright';
import { InitializationError, NavigationError } from './errors';
import { GroqClient } from './GroqClient';
import type { LogLine, AvailableModel as StagehandAvailableModel } from '@browserbasehq/stagehand';

export interface StagehandInstance {
  stagehand: Stagehand;
  page: Page;
  context: BrowserContext;
  cleanup: () => Promise<void>;
}

// Default timeouts in milliseconds
export const DEFAULT_TIMEOUTS = {
  INIT: 30000, // 30 seconds for initialization
  NAVIGATION: 30000, // 30 seconds for navigation
  ACTION: 120000, // 120 seconds for actions
  ACTION_STEP: 120000, // 120 seconds for individual action steps
  EXTRACTION: 60000, // 60 seconds for data extraction
  OBSERVATION: 30000, // 30 seconds for observation
  CLEANUP: 5000, // 5 seconds for cleanup
} as const;

export async function createStagehand(
  options: SharedBrowserCommandOptions
): Promise<StagehandInstance> {
  try {
    const overridePromise = overrideStagehandInit();
    const config = loadConfig();
    const stagehandConfig = loadStagehandConfig(config);
    validateStagehandConfig(stagehandConfig);

    // Create a strongly typed logger function
    const logger = (message: LogLine): void => {
      const loggerFn = stagehandLogger(options?.debug ?? stagehandConfig.verbose);
      if (loggerFn) {
        void loggerFn(message);
      }
    };

    const stagehandOptions: ConstructorParams = {
      env: 'LOCAL',
      headless: options?.headless ?? stagehandConfig.headless,
      verbose: options?.debug || stagehandConfig.verbose ? 1 : 0,
      debugDom: options?.debug ?? stagehandConfig.debugDom,
      enableCaching: stagehandConfig.enableCaching,
      logger,
    };

    const { model, provider } = getStagehandModel(stagehandConfig, { model: options?.model });
    console.log('model', { model, provider });
    // Set up LLMProvider for non-Groq providers
    if (provider !== 'groq' && model) {
      stagehandOptions.modelName = model as StagehandAvailableModel;
      stagehandOptions.apiKey = getStagehandApiKey(stagehandConfig);
    }

    // Set up Groq client if using Groq provider
    if (provider === 'groq') {
      if (!model) {
        throw new Error('A model name must be specified when using Groq provider');
      }
      stagehandOptions.llmClient = new GroqClient({
        enableCaching: stagehandConfig.enableCaching,
        modelName: model as StagehandAvailableModel,
        clientOptions: {
          apiKey: getStagehandApiKey({ ...stagehandConfig, provider }),
        },
      });
    }

    console.log('using stagehand options', { ...stagehandOptions, apiKey: 'REDACTED' });
    await overridePromise;
    const stagehand = new Stagehand(stagehandOptions);

    // Initialize with timeout
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
      setTimeout(() => reject(new Error('Initialization timeout')), DEFAULT_TIMEOUTS.INIT)
    );
    await Promise.race([initPromise, initTimeoutPromise]);

    const cleanup = async () => {
      await Promise.race([
        options?.connectTo ? Promise.resolve() : stagehand.page.close(),
        stagehand.close(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Page close timeout')), DEFAULT_TIMEOUTS.CLEANUP)
        ),
      ]);
    };

    return { stagehand, page: stagehand.page, context: stagehand.context, cleanup };
  } catch (error) {
    if (error instanceof Error) {
      throw new InitializationError(`Failed to initialize Stagehand: ${error.message}`, error);
    }
    throw new InitializationError('Failed to initialize Stagehand: Unknown error', error);
  }
}

export async function navigateToUrl(
  stagehand: Stagehand,
  url: string,
  timeout: number = DEFAULT_TIMEOUTS.NAVIGATION
): Promise<void> {
  if (url === 'current') {
    console.log('Skipping navigation - using current page');
    return;
  }

  if (url === 'reload-current') {
    console.log('Reloading current page');
    try {
      const reloadPromise = stagehand.page.reload();
      const reloadTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Reload timeout')), timeout)
      );
      await Promise.race([reloadPromise, reloadTimeoutPromise]);
      return;
    } catch (error) {
      throw new NavigationError('Failed to reload current page.', error);
    }
  }

  const currentUrl = await stagehand.page.url();
  if (currentUrl === url) {
    console.log('Skipping navigation - already on correct page');
    return;
  }

  try {
    const gotoPromise = stagehand.page.goto(url);
    const gotoTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Navigation timeout')), timeout)
    );
    await Promise.race([gotoPromise, gotoTimeoutPromise]);
  } catch (error) {
    throw new NavigationError(
      `Failed to navigate to ${url}. Please check if the URL is correct and accessible.`,
      error
    );
  }
}
