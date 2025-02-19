import { Stagehand, ConstructorParams } from '@browserbasehq/stagehand';
import type { SharedBrowserCommandOptions } from '../browserOptions';
import { loadConfig } from '../../../config';
import {
  loadStagehandConfig,
  validateStagehandConfig,
  getStagehandApiKey,
  getStagehandModel,
} from './config';
import { stagehandLogger } from './initOverride';
import { setupVideoRecording } from '../utilsShared';
import { Page, BrowserContext } from 'playwright';
import { CommandGenerator } from '../../../types';
import { StagehandError, InitializationError, NavigationError } from './errors';

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
  ACTION: 60000, // 60 seconds for actions
  ACTION_STEP: 30000, // 30 seconds for individual action steps
  EXTRACTION: 60000, // 60 seconds for data extraction
  OBSERVATION: 30000, // 30 seconds for observation
  CLEANUP: 5000, // 5 seconds for cleanup
} as const;

export async function createStagehand(
  options: SharedBrowserCommandOptions
): Promise<StagehandInstance> {
  try {
    const config = loadConfig();
    const stagehandConfig = loadStagehandConfig(config);
    validateStagehandConfig(stagehandConfig);

    const stagehandOptions: ConstructorParams = {
      env: 'LOCAL',
      headless: options?.headless ?? stagehandConfig.headless,
      verbose: options?.debug || stagehandConfig.verbose ? 1 : 0,
      debugDom: options?.debug ?? stagehandConfig.debugDom,
      modelName: getStagehandModel(stagehandConfig, { model: options?.model }),
      apiKey: getStagehandApiKey(stagehandConfig),
      enableCaching: stagehandConfig.enableCaching,
      logger: stagehandLogger(options?.debug ?? stagehandConfig.verbose),
    };

    // Set default values for network and console options
    options = {
      ...options,
      network: options?.network === undefined ? true : options.network,
      console: options?.console === undefined ? true : options.console,
    };

    console.log('using stagehand options', { ...stagehandOptions, apiKey: 'REDACTED' });
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
