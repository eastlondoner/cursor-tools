import type { Command, CommandGenerator, CommandOptions } from '../../types';
import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { loadConfig } from '../../config.ts';
import { ensurePlaywright } from './utils.ts';

interface ElementBrowserOptions extends CommandOptions {
  url?: string;
  selector?: string;
  html?: boolean;
  text?: boolean;
  screenshot?: string;
}

export class ElementCommand implements Command {
  private config = loadConfig();

  async *execute(query: string, initialOptions?: ElementBrowserOptions): CommandGenerator {
    let browser: Browser | undefined;
    let options = { ...initialOptions };
    try {
      // Check for Playwright availability first
      await ensurePlaywright();

      // Parse selector from query if not provided in options
      if (!options?.selector && query) {
        // If URL is provided in options, use entire query as selector
        // Otherwise, try to parse URL and selector from query
        if (options?.url) {
          options = { ...options, selector: query };
        } else {
          const parts = query.split(' ');
          if (parts.length >= 2) {
            const url = parts[0];
            const selector = parts.slice(1).join(' ');
            options = { ...options, url, selector };
          } else {
            yield 'Please provide both URL and selector. Usage: cursor-tools browser element <url> <selector> [options]';
            return;
          }
        }
      }

      if (!options?.url || !options?.selector) {
        yield 'Please provide both URL and selector. Usage: cursor-tools browser element <url> <selector> [options]';
        return;
      }

      const browserType = chromium;

      yield 'Launching browser...';
      browser = await browserType.launch({
        headless: true, // Always headless for element inspection
      });

      const page = await browser.newPage();

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
