import type { Command, CommandGenerator } from '../../../types';
import {
  createStagehand,
  navigateToUrl,
  DEFAULT_TIMEOUTS,
} from './createStagehand';
import { ExtractionSchemaError } from './errors';
import { Stagehand } from '@browserbasehq/stagehand';
import type { SharedBrowserCommandOptions } from '../browserOptions';
import {
  setupConsoleLogging,
  setupNetworkMonitoring,
  captureScreenshot,
  outputMessages,
} from '../utilsShared';
import { formatOutput, handleBrowserError } from './stagehandUtils';

export class ExtractCommand implements Command {
  async *execute(query: string, options?: SharedBrowserCommandOptions): CommandGenerator {
    if (!query) {
      yield 'Please provide an instruction and URL. Usage: browser extract "<instruction>" --url <url>';
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

      const result = await this.performExtraction(
        stagehand,
        { instruction: query, evaluate: options?.evaluate },
        options?.timeout,
        options
      );

      await captureScreenshot(page, options || {});

      // Output the structured result of the extraction
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
      for await (const message of handleBrowserError(error, options?.debug)) {
        yield message;
      }
    } finally {
      if (stagehandInstance) {
        await stagehandInstance.cleanup();
      }
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
    timeout: number = DEFAULT_TIMEOUTS.EXTRACTION,
    options?: SharedBrowserCommandOptions
  ): Promise<{
    success: boolean;
    message: string;
    data: unknown;
    instruction: string;
  }> {
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

      return {
        success: true,
        message: `Successfully extracted data for instruction: ${instruction}`,
        data: result,
        instruction,
      };
    } catch (error) {
      // Log detailed error information in debug mode
      if (options?.debug) {
        console.error('Error in performExtraction:', error);
      }

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
