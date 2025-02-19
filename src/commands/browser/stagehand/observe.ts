import type { Command, CommandGenerator } from '../../../types';
import {
  createStagehand,
  navigateToUrl,
  DEFAULT_TIMEOUTS,
} from './createStagehand';
import { ObservationError } from './errors';
import { Stagehand, ObserveResult } from '@browserbasehq/stagehand';
import type { SharedBrowserCommandOptions } from '../browserOptions';
import {
  setupConsoleLogging,
  setupNetworkMonitoring,
  captureScreenshot,
  outputMessages,
} from '../utilsShared';
import { formatOutput, handleBrowserError } from './stagehandUtils';

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
  async *execute(query: string, options?: SharedBrowserCommandOptions): CommandGenerator {
    if (!query) {
      yield 'Please provide an instruction and URL. Usage: browser observe "<instruction>" --url <url>';
      return;
    }

    const url = options?.url;
    if (!url) {
      yield 'Please provide a URL using the --url option';
      return;
    }

    let stagehandInstance;
    try {
      stagehandInstance = await createStagehand(options);
      const { stagehand, page } = stagehandInstance;

      const consoleMessages = await setupConsoleLogging(page, options || {});
      const networkMessages = await setupNetworkMonitoring(page, options || {});

      await navigateToUrl(stagehand, url, options?.timeout);

      // Execute custom JavaScript if provided
      if (options?.evaluate) {
        await page.evaluate(options.evaluate);
      }

      const result = await this.performObservation(stagehand, query, options?.timeout, options);

      await captureScreenshot(page, options || {});

      // Output the structured result of the observation
      yield formatOutput(result, options?.debug);
      for (const message of outputMessages(consoleMessages, networkMessages, options || {})) {
        yield message;
      }

      if (options?.html) {
        const htmlContent = await page.content();
        yield '\n--- Page HTML Content ---\n\n';
        yield htmlContent;
        yield '\n--- End of HTML Content ---\n';
      }

      if (options?.screenshot) {
        yield `Screenshot saved to ${options.screenshot}\n`;
      }
    } catch (error) {
      console.error(error);
      for await (const message of handleBrowserError(error, options?.debug)) {
        yield message;
      }
    } finally {
      if (stagehandInstance) {
        await stagehandInstance.cleanup();
      }
    }
  }

  private async performObservation(
    stagehand: Stagehand,
    instruction?: string,
    timeout: number = DEFAULT_TIMEOUTS.OBSERVATION,
    options?: SharedBrowserCommandOptions
  ): Promise<{
    success: boolean;
    message: string;
    elements: Array<{
      type: string;
      description: string;
      actions: string[];
      location: string;
    }>;
    instruction: string;
  }> {
    try {
      const timeoutPromise = new Promise<ObserveResult[]>((_, reject) =>
        setTimeout(() => reject(new Error('Observation timeout')), timeout)
      );

      const observeOptions = {
        instruction: instruction || 'Find interactive elements on this page',
        onlyVisible: true, // Note: Only visible elements are included in the results
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

      // Helper to determine element type and actions based on element properties
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
        success: true,
        message: `Found ${elements.length} unique interactive elements on the page`,
        elements,
        instruction: instruction || 'Find interactive elements on this page',
      };
    } catch (error) {
      // Log detailed error information in debug mode
      if (options?.debug) {
        console.error('Error in performObservation:', error);
      }

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
