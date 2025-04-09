import { OpenCommand } from '../commands/browser/open.ts';
import type { CommandGenerator, CommandOptions } from '../types.ts';
import { Writable } from 'stream';

/**
 * Fetches the HTML content of a given Notion URL using the browser open command,
 * with retries and increasing wait times.
 * @param url The Notion page URL.
 * @param debug Whether to enable debug logging (passed to OpenCommand).
 * @returns A promise that resolves with the HTML content of the page.
 * @throws If the URL is invalid or fetching fails after retries.
 */
export async function fetchNotionPageContent(url: string, debug: boolean): Promise<string> {
  console.log(`Attempting to fetch Notion page content from: ${url}`);

  // Basic URL validation
  if (!url || !url.startsWith('https://www.notion.so/')) {
    throw new Error(`Invalid Notion URL provided: ${url}`);
  }

  const openCommand = new OpenCommand();
  const waitTimes = ['3s', '5s', '10s']; // Wait times for retries

  for (let i = 0; i < waitTimes.length; i++) {
    const waitTime = waitTimes[i];
    console.log(`Attempt ${i + 1}/${waitTimes.length}: Fetching with ${waitTime} wait...`);

    let htmlContent = '';
    // Ensure headless is true for programmatic use, wait for JS, get HTML
    const options = {
      html: true,
      wait: `time:${waitTime}`,
      headless: true,
      console: false,
      network: false,
      debug: debug,
    };

    try {
      // The execute method returns an async generator
      const generator: CommandGenerator = openCommand.execute(url, options as any);

      // Collect the output from the generator
      for await (const output of generator) {
        if (typeof output === 'string') {
          htmlContent += output;
        } else if (typeof output === 'object' && output !== null && 'html' in output) {
          htmlContent += (output as { html: string }).html;
        }
      }

      // Check if significant content was fetched (simple check)
      if (htmlContent && htmlContent.length > 500) {
        // Adjust threshold as needed
        console.log(
          `Successfully fetched Notion content (length: ${htmlContent.length}) on attempt ${i + 1}`
        );
        return htmlContent;
      }

      console.log(
        `Attempt ${i + 1} failed or yielded insufficient content (length: ${htmlContent.length}).`
      );
    } catch (error) {
      console.error(`Error during Notion fetch attempt ${i + 1} with ${waitTime} wait:`, error);
      // Don't re-throw immediately, let the loop try the next wait time
    }
  }

  // If all attempts failed
  throw new Error(
    `Failed to fetch sufficient HTML content from Notion URL: ${url} after ${waitTimes.length} attempts.`
  );
}
