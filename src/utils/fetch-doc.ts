import { writeFileSync } from 'fs';
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
        }
      }

      // Clean up potential extra newlines (less critical for HTML, but keep for consistency)
      htmlContent = htmlContent.trim();

      // Check if significant content was fetched (using original threshold)
      if (htmlContent && htmlContent.length > 500) {
        console.log(
          `Successfully fetched document content (length: ${htmlContent.length}) on attempt ${i + 1}`
        );

        if (debug) {
          // save the extracted text to a file
          writeFileSync('.vibe-tools-fetched-doc.html', htmlContent);
        }

        // Extract text from the HTML content
        const extractedText = extractTextFromHtml(htmlContent, debug);

        // Check if extracted text exceeds 200k characters
        if (extractedText.length > 200000) {
          console.error(
            `WARNING: Extracted text exceeds 200,000 characters (actual: ${extractedText.length})`
          );
        }

        const debugFile = '.vibe-tools-fetched-doc.txt';
        if (debug) {
          // save the extracted text to a file
          writeFileSync(debugFile, extractedText);
          console.log(
            `[DEBUG] Original HTML attributes have been filtered to keep only: html, src, alt, title, cite, value, label, kind, type`
          );
        }

        // Log the extracted text length
        console.log(
          `Using extracted text (length: ${extractedText.length}) as document context.${
            debug ? `\n[DEBUG] Copy of extracted text saved to ${debugFile}` : ''
          }`
        );

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
 * @param debug Whether to log debug information.
 * @returns The extracted text content.
 */
function extractTextFromHtml(html: string, debug: boolean = false): string {
  // Strip unwanted attributes first
  html = stripUnwantedAttributes(html, debug);

  // remove script/style blocks wholesale
  html = html.replace(
    /<(script|style|canvas|header|footer|iframe|frame|button|data|datalist|input|embed|map|meta|nav|object|select|svg|template|textarea)[^>]*>[\s\S]*?<\/\1>/gi,
    ''
  );

  // Define the tags to extract text from (case-insensitive)
  const textTagsPattern =
    '(?:span|a|title|p|h[1-6]|li|div|pre|code|abbr|address|article|aside|b|blockquote|caption|cite|dd|dl|dt|em|figure|figcaption|hr|i|ins|label|li|main|mark|nav|noscript|ol|output|p|pre|q|s|samp|section|small|span|strong|sub|sup|table|title|track|tbody|td|tfoot|th|thead|tr|u|ul|var)';

  // Regex to find text content within the specified tags
  const pattern = new RegExp(`<(${textTagsPattern})[^>]*>(.*?)<\\/\\1>`, 'gis');

  const extractedTexts: string[] = [];
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const tagName = match[1];
    const textContent = match[2];

    // Decode HTML entities
    const decodedText = decodeHtmlEntities(textContent);

    // Strip only HTML tags for non-code/pre; preserve literal <...> in code/pre blocks
    // Basic regex to match likely HTML tags (e.g., <p>, <span>, </div>, <br />)
    // while ignoring things like <inboxId>
    const htmlTagRegex =
      /<\/?(?:p|div|span|br|pre|input|textarea|link|meta|main|section|article|code|var|h[1-6])\b[^>]*>/g;
    const textWithoutInnerTags =
      tagName === 'code' || tagName === 'pre' ? decodedText : decodedText.replace(htmlTagRegex, '');

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
 * Strips all HTML attributes from tags except for the allowed list.
 * @param html The HTML content to process.
 * @param debug Whether to log debug information.
 * @returns The HTML with only allowed attributes.
 */
function stripUnwantedAttributes(html: string, debug: boolean = false): string {
  // List of allowed attributes
  const allowedAttributes = [
    'href',
    'src',
    'alt',
    'title',
    'cite',
    'value',
    'label',
    'kind',
    'type',
  ];

  if (debug) {
    console.log(`Stripping HTML attributes, keeping only: ${allowedAttributes.join(', ')}`);
  }

  let strippedCount = 0;
  let keptCount = 0;

  // First, handle opening tags with attributes
  html = html.replace(/<([a-zA-Z][a-zA-Z0-9]*)\s+([^>]*)>/g, (match, tagName, attributesStr) => {
    // Check if it's a self-closing tag
    const isSelfClosing = attributesStr.endsWith('/');
    const selfClosingSlash = isSelfClosing ? '/' : '';

    // Process attributes (remove the trailing / for self-closing tags)
    attributesStr = isSelfClosing ? attributesStr.slice(0, -1).trim() : attributesStr;
    const attributes: string[] = [];

    // Match individual attributes
    const attrRegex = /([a-zA-Z0-9-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]*))|)/g;
    let attrMatch;

    // All attributes in the tag
    const allAttributes: string[] = [];

    while ((attrMatch = attrRegex.exec(attributesStr)) !== null) {
      const attrName = attrMatch[1];
      allAttributes.push(attrName);

      if (allowedAttributes.includes(attrName.toLowerCase())) {
        // Keep the original attribute including its value
        attributes.push(attrMatch[0]);
        keptCount++;
      } else {
        strippedCount++;
      }
    }

    // Reconstruct the tag with only allowed attributes
    if (attributes.length > 0) {
      return `<${tagName} ${attributes.join(' ')}${selfClosingSlash}>`;
    } else {
      return `<${tagName}${selfClosingSlash}>`;
    }
  });

  if (debug) {
    console.log(
      `Attribute stripping complete: Kept ${keptCount} allowed attributes, removed ${strippedCount} disallowed attributes.`
    );
  }

  // Return the processed HTML, ensuring closing tags stay intact
  return html;
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
