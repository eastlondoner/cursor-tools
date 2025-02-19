import { Stagehand } from '@browserbasehq/stagehand';
import type { SharedBrowserCommandOptions } from '../browserOptions';
import { LogLine, BrowserResult } from '@browserbasehq/stagehand';
import { once } from '../../../utils/once';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BrowserContext, chromium } from 'playwright';

import { scriptContent } from './scriptContent';

export interface RecordVideoOptions {
  dir: string;
}

const DUMB_MESSAGES = new Set([
  'clicked element',
  'running / continuing action',
  'looking at chunk',
  'creating chat completion',
  'processing DOM',
  'transformed response',
]);

const BORING_MESSAGES = new Set([
  'launching local browser',
  'local browser started successfully.',
  'action completed successfully',
  'finished waiting for (possible) page navigation',
]);

export function stagehandLogger(
  verbose: boolean
): ((message: LogLine) => void | Promise<void>) | undefined {
  return (message) => {
    if (process.env.DEBUG_LOG) {
      fs.appendFileSync('stagehand-debug.log', JSON.stringify(message, null, 2));
    }

    if (DUMB_MESSAGES.has(message.message)) {
      return;
    }

    if (BORING_MESSAGES.has(message.message)) {
      console.log('Stagehand:', message.message);
      return;
    }

    if (message.message === 'received response from LLM') {
      console.log('Stagehand:', message.auxiliary?.response?.value);
      return;
    }

    if (message.message === 'response') {
      const value = message?.auxiliary?.response?.value;
      if (value) {
        const completionResponse = JSON.parse(value);
        const content = completionResponse?.content;
        if (Array.isArray(content)) {
          for (const chunk of content) {
            const text = chunk?.text;
            if (text) {
              console.log('Stagehand: ', text);
            }
          }
          return;
        }
      }
    }

    if (verbose) {
      console.log('Stagehand:', message);
    } else {
      console.log('Stagehand:', message.message, message.auxiliary);
    }
  };
}

export async function getBrowser(
  apiKey: string | undefined,
  projectId: string | undefined,
  env: 'LOCAL' | 'BROWSERBASE' = 'LOCAL',
  options: {
    headless: boolean;
    recordVideo: RecordVideoOptions | undefined;
    viewport?: { width: number; height: number };
    connectTo: number | undefined;
  },
  logger: (message: LogLine) => void
): Promise<BrowserResult> {
  console.log('getBrowser', {
    apiKey,
    projectId,
    env,
    options,
    logger,
  });
  try {
    logger({
      category: 'init',
      message: 'launching local browser',
      level: 0,
      auxiliary: options as any,
    });

    const tmpDirPath = path.join(os.tmpdir(), 'stagehand');
    if (!fs.existsSync(tmpDirPath)) {
      fs.mkdirSync(tmpDirPath, { recursive: true });
    }
    const tmpDir = fs.mkdtempSync(path.join(tmpDirPath, 'ctx_'));
    fs.mkdirSync(path.join(tmpDir, 'userdir/Default'), { recursive: true });
    const defaultPreferences = {
      plugins: {
        always_open_pdf_externally: true, // Prevent PDFs from opening in the built-in PDF viewer.
      },
    };
    fs.writeFileSync(
      path.join(tmpDir, 'userdir/Default/Preferences'),
      JSON.stringify(defaultPreferences)
    );

    const downloadsPath = path.join(process.cwd(), 'downloads');
    fs.mkdirSync(downloadsPath, { recursive: true });

    let context: BrowserContext;

    if (options.connectTo) {
      const browser = await chromium.connectOverCDP(`http://localhost:${options.connectTo}`);
      logger({
        category: 'init',
        message: 'connected to existing browser',
        level: 1,
      });

      // Get or create context
      context =
        (await browser.contexts()[0]) ||
        (await browser.newContext({
          recordVideo: options.recordVideo,
          acceptDownloads: true,
          viewport: options.viewport,
          locale: 'en-US',
          timezoneId: 'America/New_York',
          bypassCSP: true,
          deviceScaleFactor: 1,
          colorScheme: null, // Use system color scheme
        }));

      // Get existing pages
      const pages = await context.pages();
      if (pages.length > 0) {
        logger({
          category: 'init',
          message: 'using existing page',
          level: 1,
          auxiliary: {
            pageCount: {
              value: pages.length.toString(),
              type: 'integer',
            },
          },
        });
        await Promise.all(pages.map((page) => page.evaluate(scriptContent())));
      }
    } else {
      context = await chromium.launchPersistentContext(path.join(tmpDir, 'userdir'), {
        recordVideo: options.recordVideo,
        acceptDownloads: true,
        headless: options.headless,
        viewport: options.viewport,
        colorScheme: null,
        locale: 'en-US',
        timezoneId: 'America/New_York',
        deviceScaleFactor: 1,
        args: [
          '--enable-webgl',
          '--use-gl=swiftshader',
          '--enable-accelerated-2d-canvas',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
        ],
        bypassCSP: true,
        timeout: 30_000,
      });
      logger({
        category: 'init',
        message: 'local browser started successfully.',
        level: 1,
      });
    }

    await applyStealthScripts(context);
    return { context, contextPath: tmpDir, env: 'LOCAL' };
  } catch (e) {
    console.error('Error initializing browser:', e);
    logger({
      category: 'init',
      message: 'failed to launch local browser',
      level: 2,
      auxiliary: {
        error: {
          value: e instanceof Error ? e.message : String(e),
          type: 'string',
        },
        trace: {
          value: e instanceof Error && e.stack ? e.stack : '',
          type: 'string',
        },
      },
    });
    throw e;
  }
}

async function applyStealthScripts(context: BrowserContext) {
  await context.addInitScript(() => {
    // Override the navigator.webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Mock languages and plugins to mimic a real browser
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Remove Playwright-specific properties
    // @ts-ignore
    // eslint-disable-next-line no-undef
    delete window.__playwright;
    // @ts-ignore
    // eslint-disable-next-line no-undef
    delete window.__pw_manual;
    // @ts-ignore
    // eslint-disable-next-line no-undef
    delete window.__PW_inspect;

    // Redefine the headless property
    Object.defineProperty(navigator, 'headless', {
      get: () => false,
    });

    // Override the permissions API
    // eslint-disable-next-line no-undef
    const originalQuery = window.navigator.permissions.query;
    // eslint-disable-next-line no-undef
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({
            state: Notification.permission,
          } as PermissionStatus)
        : originalQuery(parameters);
  });
}

const oldInit = Stagehand.prototype.init;

// --- FIX FOR STAGEHAND ---
const patchStagehand = once(async () => {
  const tempStagehand = new Stagehand({
    env: 'LOCAL',
    apiKey: 'test',
    verbose: 0,
    debugDom: false,
    headless: true,
    logger: () => {},
  });
  await oldInit.call(tempStagehand);
  const StagehandPage = tempStagehand['stagehandPage']!.constructor;
  const StagehandContext = tempStagehand['stagehandContext']!.constructor;
  tempStagehand.context.addInitScript;
  await tempStagehand.close();
  return { StagehandPage, StagehandContext };
});

function _overrideStagehandInit() {
  console.log('overriding stagehand init');
  //@ts-ignore
  Stagehand.prototype.init = async function myinit(
    initOptions:
      | undefined
      | {
          recordVideo: RecordVideoOptions;
          viewport?: SharedBrowserCommandOptions['viewport'];
          connectTo?: SharedBrowserCommandOptions['connectTo'];
        }
  ): Promise<{ debugUrl: string; sessionUrl: string; sessionId: string }> {
    const { StagehandPage, StagehandContext } = await patchStagehand();
    const viewport = initOptions?.viewport?.toLowerCase().split('x').map(Number);
    const viewportSize = initOptions?.connectTo
      ? undefined
      : { width: viewport?.[0] ?? 1280, height: viewport?.[1] ?? 720 };
    console.log('initOptions', initOptions);
    const browserResult = await getBrowser(
      this['apiKey'],
      this['projectId'],
      this['env'],
      {
        headless: this.headless,
        recordVideo: initOptions?.recordVideo,
        viewport: viewportSize,
        connectTo: initOptions?.connectTo,
      },
      this.logger
    ).catch((e) => {
      console.error('Error in init:', e);
      this.logger({
        category: 'init',
        message: 'Stagehand initialization failed',
        level: 2,
        auxiliary: {
          error: {
            value: e instanceof Error ? e.message : String(e),
            type: 'string',
          },
        },
      });
      throw e;
    });

    this['intEnv'] = browserResult.env;
    this['contextPath'] = browserResult.contextPath;
    if (!browserResult.context) {
      throw new Error('Failed to initialize browser context');
    }

    this['stagehandContext'] = await StagehandContext.init(browserResult.context, this);

    const pages = await browserResult.context.pages();
    const defaultPage =
      pages.length > 0 ? pages[pages.length - 1] : await browserResult.context.newPage();

    this['stagehandPage'] = await new StagehandPage(
      defaultPage,
      this,
      this['stagehandContext'],
      this['llmClient'],
      this['userProvidedInstructions']
    ).init();

    // Set the browser to headless mode if specified
    if (viewportSize && this.headless && !initOptions?.connectTo) {
      await this.page.setViewportSize(viewportSize);
    }

    await browserResult.context.addInitScript({
      content: scriptContent(),
    });

    this.browserbaseSessionID = browserResult.sessionId;

    return {
      debugUrl: browserResult.debugUrl ?? '',
      sessionUrl: browserResult.sessionUrl ?? '',
      sessionId: browserResult.sessionId ?? '',
    };
  };
}

export const overrideStagehandInit = once(_overrideStagehandInit);
