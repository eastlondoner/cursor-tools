import fs from 'fs';
import { promisify } from 'util';
import path from 'path';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Output text to standard output and optionally save to a file
 * This function is used by commands to output content
 *
 * @param text - The text to output
 * @param options - Optional configuration
 * @param options.saveTo - Path to save output to (in addition to stdout)
 * @param options.quiet - Suppress stdout output (only useful with saveTo)
 * @param prefix - Optional prefix to add to the text
 */
export async function yieldOutput(
  text: string,
  options: { saveTo?: string; quiet?: boolean; appendTo?: boolean },
  prefix?: string
): Promise<void> {
  // Format text with prefix if provided
  const outputText = prefix ? `[${prefix}] ${text}` : text;

  // Output to stdout unless quiet is true
  if (!options?.quiet) {
    process.stdout.write(outputText);
  }

  // Save to file if saveTo is specified
  if (options?.saveTo) {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(options.saveTo);
      await mkdir(dir, { recursive: true });

      // Write to file (append if appendTo is true)
      const flag = options.appendTo ? 'a' : 'w';
      await writeFile(options.saveTo, outputText, { flag });
    } catch (error) {
      console.error(`Error saving output to ${options.saveTo}:`, error);
    }
  }
}

/**
 * Function to handle file output in a consistent manner
 *
 * @param outputPath - Path to save the file
 * @param content - Content to write to the file
 * @param type - Optional content type for logging
 */
export async function saveToFile(
  outputPath: string,
  content: string,
  type: string = 'output'
): Promise<void> {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    await mkdir(dir, { recursive: true });

    // Write content to file
    await writeFile(outputPath, content);
    console.log(`${type} saved to: ${outputPath}`);
  } catch (error) {
    console.error(`Error saving ${type} to ${outputPath}:`, error);
    throw error;
  }
}
