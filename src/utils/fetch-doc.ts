import { OpenCommand } from '../commands/browser/open.ts';
import type { CommandGenerator, CommandOptions } from '../types';
import { Writable } from 'stream';

/**
 * Fetches the HTML content of a given URL using the browser open command,
 * extracts the text content, and performs validation.
 * @param url The document URL.
 * @param debug Whether to enable debug logging (passed to OpenCommand).
 * @returns A promise that resolves with the extracted text content of the page.
 * @throws If fetching fails after retries or if content validation fails.
 */
export async function fetchDocContent(url: string, debug: boolean): Promise<string> {
  console.log(`Attempting to fetch document content from: ${url}`);

  // No URL validation needed here, browser command handles it

  const openCommand = new OpenCommand();
  const waitTimes = ['3s', '5s', '10s']; // Wait times for retries

  for (let i = 0; i < waitTimes.length; i++) {
    const waitTime = waitTimes[i];
    console.log(`Attempt ${i + 1}/${waitTimes.length}: Fetching with ${waitTime} wait...`);

    let htmlContent = '';
    // Ensure headless is true for programmatic use, wait for JS, get HTML
    const options: any = {
      wait: `time:${waitTime}`,
      headless: true,
      console: false,
      network: false,
      html: true,
      debug: debug,
    };

    try {
      // The execute method returns an async generator
      const generator: CommandGenerator = openCommand.execute(url, options);

      // Collect the HTML output from the generator
      for await (const output of generator) {
        if (typeof output === 'string') {
          htmlContent += output;
        } else if (typeof output === 'object' && output !== null && 'html' in output) {
          // Handle the case where HTML might be nested in an object (as seen in some browser command outputs)
          const outputAsAny = output as any; // Cast for safety, though 'html' check helps
          if (typeof outputAsAny.html === 'string') {
            htmlContent += outputAsAny.html;
          }
        }
      }

      // Clean up potential extra newlines (less critical for HTML, but keep for consistency)
      htmlContent = htmlContent.trim();

      // Check if significant content was fetched (using original threshold)
      if (htmlContent && htmlContent.length > 500) {
        console.log(
          `Successfully fetched document content (length: ${htmlContent.length}) on attempt ${i + 1}`
        );

        // Extract text from the HTML content
        const extractedText = extractTextFromHtml(htmlContent);

        // Check if extracted text exceeds 200k characters
        if (extractedText.length > 200000) {
          console.error(
            `WARNING: Extracted text exceeds 200,000 characters (actual: ${extractedText.length})`
          );
        }

        // Log the extracted text length
        console.log(`Using extracted text (length: ${extractedText.length}) as document context.`);

        return extractedText;
      }

      console.log(
        `Attempt ${i + 1} failed or yielded insufficient content (length: ${htmlContent.length}).`
      );
    } catch (error) {
      console.error(`Error during document fetch attempt ${i + 1} with ${waitTime} wait:`, error);
      // Don't re-throw immediately, let the loop try the next wait time
    }
  }

  // If all attempts failed
  throw new Error(
    `Failed to fetch sufficient HTML content from document URL: ${url} after ${waitTimes.length} attempts.`
  );
}

/**
 * Extracts text content from HTML by targeting specific tags and removing HTML entities.
 * @param html The HTML content to extract text from.
 * @returns The extracted text content.
 */
function extractTextFromHtml(html: string): string {
  // Define the tags to extract text from (case-insensitive)
  const textTagsPattern = '(?:span|a|title|p|h[1-6]|li|div)';

  // Regex to find text content within the specified tags
  const pattern = new RegExp(`<(${textTagsPattern})[^>]*>(.*?)<\\/\\1>`, 'gis');

  const extractedTexts: string[] = [];
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const textContent = match[2];

    // Decode HTML entities
    const decodedText = decodeHtmlEntities(textContent);

    // Remove inner tags
    const textWithoutInnerTags = decodedText.replace(/<[^>]+>/g, '');

    // Strip leading/trailing whitespace
    const strippedText = textWithoutInnerTags.trim();

    if (strippedText) {
      // Only add non-empty text
      extractedTexts.push(strippedText);
    }
  }

  // Join the extracted texts with newlines
  return extractedTexts.join('\n');
}

/**
 * Decodes HTML entities to their corresponding characters.
 * @param html The HTML string containing entities to decode.
 * @returns The decoded string.
 */
function decodeHtmlEntities(html: string): string {
  // Simple entity decoding for common entities
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}
