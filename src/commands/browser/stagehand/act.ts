import type { Command, CommandGenerator } from '../../../types';
import { createStagehand, navigateToUrl, DEFAULT_TIMEOUTS } from './createStagehand';
import { ActionError } from './errors';
import { Stagehand } from '@browserbasehq/stagehand';
import type { SharedBrowserCommandOptions } from '../browserOptions';
import {
  setupConsoleLogging,
  setupNetworkMonitoring,
  captureScreenshot,
  outputMessages,
} from '../utilsShared';
import { formatOutput, handleBrowserError } from './stagehandUtils';

export class ActCommand implements Command {
  async *execute(query: string, options?: SharedBrowserCommandOptions): CommandGenerator {
    if (!query) {
      yield 'Please provide an instruction and URL. Usage: browser act "<instruction>" --url <url>';
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

      const result = await this.performAction(
        stagehand,
        { instruction: query, evaluate: options?.evaluate },
        options?.timeout,
        options
      );

      await captureScreenshot(page, options || {});

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
      yield 'error in stagehand: ' + handleBrowserError(error, options?.debug);
    } finally {
      if (stagehandInstance) {
        await stagehandInstance.cleanup();
      }
    }
  }

  private async performAction(
    stagehand: Stagehand,
    {
      instruction,
      evaluate,
    }: {
      instruction: string;
      evaluate?: string;
    },
    timeout: number = DEFAULT_TIMEOUTS.ACTION,
    options?: SharedBrowserCommandOptions
  ): Promise<{
    success: boolean;
    message: string;
    startUrl: string;
    endUrl: string;
    instruction: string;
  }> {
    try {
      // Get the current URL before the action
      const startUrl = await stagehand.page.url();
      let totalTimeout: ReturnType<typeof setTimeout> | undefined;
      const totalTimeoutPromise = new Promise<void>(
        (_, reject) =>
          (totalTimeout = setTimeout(() => reject(new Error('Action timeout')), timeout))
      );

      if (evaluate) {
        await Promise.race([stagehand.page.evaluate(evaluate), totalTimeoutPromise]);
      }

      let resultMessages: Array<string> = [];
      // Perform action with timeout
      const initialDomSettleTimeout = 30000;
      let stepNumber = 0;
      for (const instruct of instruction.split('|')) {
        stepNumber++;
        let stepTimeout: ReturnType<typeof setTimeout> | undefined;
        const stepTimeoutPromise = new Promise<void>((_, reject) => {
          stepTimeout = setTimeout(
            () => reject(new Error('step timeout')),
            DEFAULT_TIMEOUTS.ACTION_STEP
          );
        });

        // Execute the action and wait for it to complete
        const result = await Promise.race([stagehand.page.act({
          action: instruct,
          domSettleTimeoutMs: stepNumber === 1 ? initialDomSettleTimeout : 100
        }), totalTimeoutPromise, stepTimeoutPromise]);
        if (stepTimeout !== undefined) {
          clearTimeout(stepTimeout);
        }
        if (!result) {
          throw new ActionError(`Action timeout Failed to perform action: ${instruction}`, {
            instruction,
            error: new Error('Action timeout'),
            startUrl: await stagehand.page.url(),
          });
        }
        if (result.success === false) {
          console.log('result situation', result);
          throw new ActionError(`${result.message} Failed to perform action: ${result.action} for instruction ${instruction}`, {
            instruction,
            error: new Error(result.message),
            startUrl: await stagehand.page.url(),
          });
        }
        resultMessages.push(result.message);

        // Wait for the DOM to be ready after the action
        await Promise.race([
          stagehand.page.waitForLoadState('domcontentloaded'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DOM load timeout')), DEFAULT_TIMEOUTS.ACTION_STEP)
          ),
        ]);

        console.log('step done', instruct);
      }

      // Wait for potential navigation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get the current URL after the action
      const endUrl = await stagehand.page.url();

      if (totalTimeout) {
        clearTimeout(totalTimeout);
      }

      // If the URL changed, consider the action successful
      if (endUrl !== startUrl) {
        return {
          success: true,
          message: `Successfully performed action: ${instruction} (final url ${endUrl})\n${resultMessages.join('\n')}`,
          startUrl,
          endUrl,
          instruction,
        };
      }

      return {
        success: true,
        message: `Successfully performed action: ${instruction}\n${resultMessages.join('\n')}`,
        startUrl,
        endUrl,
        instruction,
      };
    } catch (error) {
      // Log detailed error information in debug mode
      if (options?.debug) {
        console.error('Error in performAction:', error);
      }

      if (error instanceof Error) {
        throw new ActionError(`${error.message} Failed to perform action: ${instruction}`, {
          instruction,
          error,
          startUrl: await stagehand.page.url(),
          pageContent: await stagehand.page.content(),
          availableElements: await stagehand.page.$$eval(
            'a, button, [role="button"], input, select, textarea',
            (elements: Element[]) =>
              elements.map((el) => ({
                text: el.textContent?.trim(),
                ariaLabel: el.getAttribute('aria-label'),
                role: el.getAttribute('role'),
                tag: el.tagName.toLowerCase(),
              }))
          ),
        });
      }
      throw error;
    }
  }
}
