import type { Command, CommandGenerator, CommandOptions } from '../../types';
import { chromium } from 'playwright';
import { loadConfig } from '../../config.ts';
import { ensurePlaywright } from './utils.ts';
import type { SharedBrowserCommandOptions } from './browserOptions';
import { setupConsoleLogging, setupNetworkMonitoring, outputMessages } from './utilsShared';

interface ElementBrowserOptions extends SharedBrowserCommandOptions {
  selector?: string;
  text?: boolean;
}

export class ElementCommand implements Command {
  private config = loadConfig();

  async *execute(query: string, options: ElementBrowserOptions): CommandGenerator {
    let browser;
    let consoleMessages: string[] = [];
    let networkMessages: string[] = [];

    // Set default options
    options = {
      ...options,
      network: options?.network === undefined ? true : options.network,
      console: options?.console === undefined ? true : options.console,
    };

    try {
      // Check for Playwright availability first
      await ensurePlaywright();

      // Parse selector from query if not provided in options
      if (!options?.selector && query) {
        if (options?.url) {
          options = { ...options, selector: query };
        } else {
          const parts = query.split(' ');
          if (parts.length >= 2) {
            const url = parts[0];
            const selector = parts.slice(1).join(' ');
            options = { ...options, url, selector };
          } else {
            yield 'Please provide both URL and selector. Usage: vibe-tools browser element <url> <selector> [options]';
            return;
          }
        }
      }

      if (!options?.url || !options?.selector) {
        yield 'Please provide both URL and selector. Usage: vibe-tools browser element <url> <selector> [options]';
        return;
      }

      const browserType = chromium;
      yield 'Launching browser...';
      browser = await browserType.launch({
        headless: true, // Always headless for element inspection
      });
      const page = await browser.newPage();

      // Setup console and network monitoring
      consoleMessages = await setupConsoleLogging(page, options);
      networkMessages = await setupNetworkMonitoring(page, options);

      yield `Navigating to ${options.url}...`;
      await page.goto(options.url, { timeout: this.config.browser?.timeout ?? 30000 });

      yield `Finding element with selector "${options.selector}"...`;
      const element = await page.$(options.selector);

      if (!element) {
        yield `Element with selector "${options.selector}" not found on the page.`;
        return;
      }

      if (options.html === true) {
        const elementHTML = await element.innerHTML();
        yield '\n--- Element HTML Content ---\n\n';
        yield elementHTML;
        yield '\n--- End of Element HTML Content ---\n';
      }

      if (options.text === true) {
        const elementText = await element.textContent();
        yield '\n--- Element Text Content ---\n\n';
        yield elementText?.trim() || '';
        yield '\n--- End of Element Text Content ---\n';
      }

      if (options.screenshot) {
        yield `Taking screenshot of element and saving to ${options.screenshot}...`;
        await element.screenshot({ path: options.screenshot });
        yield 'Element screenshot saved.\n';
      }

      // If no output options specified, show both HTML and text by default
      if (options.html === undefined && options.text === undefined && !options.screenshot) {
        const elementHTML = await element.innerHTML();
        const elementText = await element.textContent();

        yield '\n--- Element Content ---\n\n';
        yield 'HTML:\n';
        yield elementHTML;
        yield '\n\nText:\n';
        yield elementText?.trim() || '';
        yield '\n--- End of Element Content ---\n';
      }

      // Output console and network messages
      for (const message of outputMessages(consoleMessages, networkMessages, options)) {
        yield message;
      }
    } catch (error) {
      yield `Browser element command error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      if (browser) {
        await browser.close();
        yield 'Browser closed.\n';
      }
    }
  }
}
