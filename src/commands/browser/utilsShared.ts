import type { SharedBrowserCommandOptions } from './browserOptions';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CommandGenerator } from '../../types';
import type { Page } from 'playwright';

/**
 * Formats a console message with location and stack trace information.
 *
 * @param msg - The console message object from Playwright
 * @returns A formatted string containing the message type, text, location, and stack trace (for errors)
 *
 * @example
 * ```typescript
 * page.on('console', async (msg) => {
 *   const formatted = await formatConsoleMessage(msg);
 *   console.log(formatted);
 * });
 * ```
 */
export async function formatConsoleMessage(msg: any): Promise<string> {
  const type = msg.type();
  const text = msg.text();
  const location = msg.location();
  let formattedMsg = `Browser Console (${type}): ${text}`;

  // Add location information if available
  if (location.url) {
    formattedMsg += `\n    at ${location.url}`;
    if (location.lineNumber) {
      formattedMsg += `:${location.lineNumber}`;
      if (location.columnNumber) {
        formattedMsg += `:${location.columnNumber}`;
      }
    }
  }

  // For errors, try to get the stack trace
  if (type === 'error') {
    try {
      const args = await Promise.all(msg.args().map((arg: any) => arg.jsonValue()));
      const errorDetails = args.find(
        (arg: unknown) => arg && typeof arg === 'object' && 'stack' in arg
      );
      if (errorDetails?.stack) {
        formattedMsg += `\n${errorDetails.stack}`;
      }
    } catch {
      // Ignore errors in getting stack trace
    }
  }

  return formattedMsg;
}

/**
 * Sets up console message logging for a Playwright page.
 *
 * @param page - The Playwright Page instance to monitor
 * @param options - Browser command options containing console logging preferences
 * @returns An array of captured console messages
 * @throws {Error} If the page instance is not valid
 *
 * @example
 * ```typescript
 * const messages = await setupConsoleLogging(page, { console: true });
 * ```
 */
export async function setupConsoleLogging(
  page: Page,
  options: SharedBrowserCommandOptions
): Promise<string[]> {
  const consoleMessages: string[] = [];
  if (options.console === true) {
    page.on('console', async (msg) => {
      consoleMessages.push(await formatConsoleMessage(msg));
    });
    page.on('pageerror', (error) => {
      consoleMessages.push(
        `Browser Console (error): Uncaught ${error.message}\n${error.stack || ''}`
      );
    });
  }
  return consoleMessages;
}

/**
 * Sets up network request/response monitoring for a Playwright page.
 *
 * @param page - The Playwright Page instance to monitor
 * @param options - Browser command options containing network monitoring preferences
 * @returns An array of captured network messages
 * @throws {Error} If the page instance is not valid or if route interception fails
 *
 * @example
 * ```typescript
 * const messages = await setupNetworkMonitoring(page, { network: true });
 * ```
 */
export async function setupNetworkMonitoring(
  page: Page,
  options: SharedBrowserCommandOptions
): Promise<string[]> {
  const networkMessages: string[] = [];
  if (options.network === true) {
    await page.route('**/*', async (route) => {
      const request = route.request();
      networkMessages.push(
        `Network Request: ${request.method()} ${request.url()} (${request.resourceType()})`
      );

      try {
        const response = await route.fetch();
        const status = response.status();
        let message = `Network Response: ${status}`;

        // Add status text for non-200 responses
        if (status !== 200) {
          message += ` (${response.statusText()})`;
        }

        message += ` ${response.url()}`;

        // For failed responses (4xx, 5xx), try to get the response body
        if (status >= 400) {
          try {
            const text = await response.text();
            message += `\n    Response: ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`;
          } catch {
            message += '\n    Could not read response body';
          }
        }

        networkMessages.push(message);
        await route.fulfill({ response });
      } catch (error) {
        networkMessages.push(
          `Network Error: ${request.method()} ${request.url()} (${request.resourceType()}) - ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        await route.abort();
      }
    });
  }
  return networkMessages;
}

/**
 * Takes a screenshot of the current page state.
 *
 * @param page - The Playwright Page instance to screenshot
 * @param options - Browser command options containing screenshot preferences
 * @throws {Error} If the page instance is not valid or if screenshot capture fails
 *
 * @example
 * ```typescript
 * await captureScreenshot(page, { screenshot: 'output.png' });
 * ```
 */
export async function captureScreenshot(
  page: Page,
  options: SharedBrowserCommandOptions
): Promise<void> {
  if (options.screenshot) {
    await page.screenshot({ path: options.screenshot, fullPage: true });
  }
}

/**
 * Formats console and network messages for output.
 *
 * @param consoleMessages - Array of captured console messages
 * @param networkMessages - Array of captured network messages
 * @param options - Browser command options containing output preferences
 * @returns An array of formatted message strings ready for output
 *
 * @example
 * ```typescript
 * const messages = outputMessages(consoleMessages, networkMessages, { console: true, network: true });
 * for (const msg of messages) {
 *   console.log(msg);
 * }
 * ```
 */
export function outputMessages(
  consoleMessages: string[],
  networkMessages: string[],
  options: SharedBrowserCommandOptions
): string[] {
  const output: string[] = [];

  // Output network messages if explicitly enabled
  if (options.network === true && networkMessages.length > 0) {
    output.push('\n--- Network Activity ---\n');
    for (const msg of networkMessages) {
      output.push(msg + '\n');
    }
    output.push('--- End of Network Activity ---\n');
  }

  // Output console messages if explicitly enabled
  if (options.console === true && consoleMessages.length > 0) {
    output.push('\n--- Console Messages ---\n');
    for (const msg of consoleMessages) {
      output.push(msg + '\n');
    }
    output.push('--- End of Console Messages ---\n');
  }

  return output;
}

/**
 * Sets up video recording directory for Playwright
 */
export async function setupVideoRecording(
  options: SharedBrowserCommandOptions
): Promise<string | undefined> {
  if (!options.video) {
    return undefined;
  }

  try {
    const videoDir = join(options.video, new Date().toISOString().replace(/[:.]/g, '-'));

    // Ensure the video directory exists
    if (!existsSync(videoDir)) {
      mkdirSync(videoDir, { recursive: true });
    }

    // Return the directory path - actual recording is handled by browser context
    return videoDir;
  } catch (error) {
    console.error('Failed to setup video directory:', error);
    return undefined;
  }
}

/**
 * Gets the path of the recorded video and returns a message
 */
export async function stopVideoRecording(
  page: Page,
  videoDir: string | null
): Promise<string | undefined> {
  if (!videoDir) {
    return undefined;
  }

  try {
    const video = page.video();
    if (!video) {
      return undefined;
    }

    const path = await video.path();
    return `Video saved to ${path}\n`;
  } catch (error) {
    console.error('Failed to get video path:', error);
    return undefined;
  }
}

type ExecuteFunction = (query: string, options?: SharedBrowserCommandOptions) => CommandGenerator;
