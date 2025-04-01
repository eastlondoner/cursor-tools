import type { Command, CommandGenerator, CommandOptions } from '../types';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadEnv } from '../config';
import { CURSOR_RULES_TEMPLATE, CURSOR_RULES_VERSION, checkCursorRules } from '../cursorrules';
import { JsonInstallCommand } from './jsonInstall';

interface InstallOptions extends CommandOptions {
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  global?: boolean;
  json?: string;
}

// Helper function to check for local cursor-tools dependencies
async function checkLocalDependencies(targetPath: string): Promise<string | null> {
  const packageJsonPath = join(targetPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    if (dependencies['cursor-tools'] || devDependencies['cursor-tools']) {
      return `Warning: Found local cursor-tools dependency in package.json. Since cursor-tools is now designed for global installation only, please remove it from your package.json dependencies and run 'npm uninstall cursor-tools', 'pnpm uninstall cursor-tools', or 'yarn remove cursor-tools' to clean up any local installation.\n`;
    }
  } catch (error) {
    console.error('Error reading package.json:', error);
  }
  return null;
}

// Helper function to get user input and properly close stdin
async function getUserInput(prompt: string): Promise<string> {
  return new Promise<string>((resolve) => {
    process.stdout.write(prompt);
    const onData = (data: Buffer) => {
      const input = data.toString().trim();
      process.stdin.removeListener('data', onData);
      process.stdin.pause();
      resolve(input);
    };
    process.stdin.resume();
    process.stdin.once('data', onData);
  });
}

async function askForCursorRulesDirectory(): Promise<boolean> {
  // If USE_LEGACY_CURSORRULES is explicitly set, respect that setting
  if (process.env.USE_LEGACY_CURSORRULES?.toLowerCase() === 'true') {
    return false;
  }
  if (process.env.USE_LEGACY_CURSORRULES?.toLowerCase() === 'false') {
    return true;
  }
  // If USE_LEGACY_CURSORRULES is set and not empty if we've got to this point it's an unknown value.
  if (process.env.USE_LEGACY_CURSORRULES && process.env.USE_LEGACY_CURSORRULES.trim() !== '') {
    throw new Error('USE_LEGACY_CURSORRULES must be either "true" or "false"');
  }

  // Otherwise, ask the user
  const answer = await getUserInput(
    'Would you like to use the new .cursor/rules directory for cursor rules? (y/N): '
  );
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

export class InstallCommand implements Command {
  private async *setupApiKeys(): CommandGenerator {
    loadEnv(); // Load existing env files if any

    const homeEnvPath = join(homedir(), '.cursor-tools', '.env');
    const localEnvPath = join(process.cwd(), '.cursor-tools.env');

    const apiKeysConfigFileExists = existsSync(homeEnvPath) || existsSync(localEnvPath);

    // Check if keys are already set
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const hasModelBox = !!process.env.MODELBOX_API_KEY;
    const hasClickUp = !!process.env.CLICKUP_API_TOKEN;

    // For Stagehand, we need either OpenAI or Anthropic
    const hasStagehandProvider = hasOpenAI || hasAnthropic;

    if (
      (apiKeysConfigFileExists &&
        hasPerplexity &&
        hasGemini &&
        hasOpenRouter &&
        hasModelBox &&
        hasClickUp) ||
      (process.env.SKIP_CLICKUP && (hasStagehandProvider || process.env.SKIP_STAGEHAND))
    ) {
      return;
    }

    /**
     * Writes keys to an environment file while preserving existing content.
     * Handles comments, empty lines, and special characters in values.
     *
     * Features:
     * - Preserves existing environment variables not being updated
     * - Maintains comments and empty lines in existing file
     * - Properly handles values containing equals signs or quotes
     * - Always quotes values for consistency
     *
     * Limitations:
     * - Does not preserve the exact formatting of the original file
     * - Assumes UTF-8 encoding for the environment file
     * - May not handle complex multi-line values
     * - Assumes basic key=value format with optional comments
     *
     * @param filePath - Path to the environment file
     * @param keys - Record of key-value pairs to write
     * @throws Will throw an error if file operations fail
     */
    const writeKeysToFile = (filePath: string, keys: Record<string, string>) => {
      // Read existing content if file exists
      let existingEnvVars: Record<string, string> = {};
      if (existsSync(filePath)) {
        try {
          const existingContent = readFileSync(filePath, 'utf-8');
          // Parse existing .env file content
          existingContent.split('\n').forEach((line) => {
            line = line.trim();
            // Skip empty lines and comments
            if (!line || line.startsWith('#')) return;

            // Find first non-escaped equals sign
            const eqIndex = line.split('').findIndex((char, i) => {
              if (char !== '=') return false;
              // Count backslashes before the equals sign
              let escapeCount = 0;
              for (let j = i - 1; j >= 0 && line[j] === '\\'; j--) {
                escapeCount++;
              }
              // If odd number of backslashes, equals is escaped
              return escapeCount % 2 === 0;
            });

            if (eqIndex !== -1) {
              const key = line.slice(0, eqIndex).trim();
              let value = line.slice(eqIndex + 1).trim();
              // Handle existing quoted values
              if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
              ) {
                // Remove surrounding quotes but preserve any escaped quotes within
                value = value.slice(1, -1);
              }
              if (key) {
                existingEnvVars[key] = value;
              }
            }
          });
        } catch (error) {
          console.error(`Warning: Error reading existing .env file at ${filePath}:`, error);
          // Continue with empty existingEnvVars rather than failing
        }
      }

      try {
        // Merge new keys with existing ones, only updating keys that have values
        const mergedKeys = {
          ...existingEnvVars,
          ...Object.fromEntries(
            Object.entries(keys).filter(([_, value]) => value) // Only include keys with values
          ),
        };

        const envContent =
          Object.entries(mergedKeys)
            .map(([key, value]) => {
              // Normalize the value to a string and handle escaping
              const normalizedValue = String(value);
              // Escape any quotes that aren't already escaped
              const escapedValue = normalizedValue.replace(/(?<!\\)"/g, '\\"');
              return `${key}="${escapedValue}"`;
            })
            .join('\n') + '\n';

        const dir = join(filePath, '..');
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(filePath, envContent, 'utf-8');
      } catch (error) {
        console.error(`Error writing to .env file at ${filePath}:`, error);
        throw error; // Rethrow to handle in caller
      }
    };

    // Try to write to home directory first, fall back to local if it fails
    try {
      const keys: Record<string, string> = {
        PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
        MODELBOX_API_KEY: process.env.MODELBOX_API_KEY || '',
        CLICKUP_API_TOKEN: process.env.CLICKUP_API_TOKEN || '',
        SKIP_STAGEHAND: process.env.SKIP_STAGEHAND || '',
      };

      if (!hasPerplexity) {
        const key = await getUserInput('Enter your Perplexity API key (or press Enter to skip): ');
        keys.PERPLEXITY_API_KEY = key;
      }

      if (!hasGemini) {
        const key = await getUserInput('Enter your Gemini API key (or press Enter to skip): ');
        keys.GEMINI_API_KEY = key;
      }

      if (!hasOpenRouter) {
        yield '\nOpenRouter provides access to various AI models including Perplexity models.\n';
        yield 'It can be used as an alternative to direct Perplexity access for web search.\n';
        const key = await getUserInput('Enter your OpenRouter API key (or press Enter to skip): ');
        keys.OPENROUTER_API_KEY = key;
      }

      if (!hasModelBox) {
        yield '\nModelBox provides unified access to various AI models through an OpenAI-compatible API.\n';
        const key = await getUserInput('Enter your ModelBox API key (or press Enter to skip): ');
        keys.MODELBOX_API_KEY = key;
      }

      // Handle Stagehand setup
      if (!hasStagehandProvider && !process.env.SKIP_STAGEHAND) {
        yield '\nStagehand requires either an OpenAI or Anthropic API key to function: ';
        const skipStagehand = await getUserInput('Would you like to skip Stagehand setup? (y/N): ');
        if (skipStagehand.toLowerCase() === 'y' || skipStagehand.toLowerCase() === 'yes') {
          keys.SKIP_STAGEHAND = 'true';
          yield 'Skipping Stagehand setup.\n';
        } else {
          yield '\n';
          if (!hasOpenAI) {
            const key = await getUserInput(
              'Enter your OpenAI API key (required for Stagehand if not using Anthropic): '
            );
            keys.OPENAI_API_KEY = key;
          }

          if (!hasAnthropic && !keys.OPENAI_API_KEY) {
            const key = await getUserInput(
              'Enter your Anthropic API key (required for Stagehand if not using OpenAI): '
            );
            keys.ANTHROPIC_API_KEY = key;
          }

          // Validate that at least one Stagehand provider key is set if not skipped
          if (!keys.OPENAI_API_KEY && !keys.ANTHROPIC_API_KEY) {
            yield '\nWarning: No API key provided for Stagehand. You will need to set either OPENAI_API_KEY or ANTHROPIC_API_KEY to use Stagehand features.\n';
          }
        }
      }

      if (!hasClickUp) {
        const key = await getUserInput(
          '[https://app.clickup.com/settings/apps] Enter your ClickUp API token (or press Enter to skip): '
        );
        keys.CLICKUP_API_TOKEN = key;
      }

      try {
        writeKeysToFile(homeEnvPath, keys);
        yield 'API keys written to ~/.cursor-tools/.env\n';
      } catch (error) {
        console.error('Error writing API keys to home directory:', error);
        // Fall back to local file if home directory write fails
        writeKeysToFile(localEnvPath, keys);
        yield 'API keys written to .cursor-tools.env in the current directory\n';
      }
    } catch (error) {
      console.error('Error setting up API keys:', error);
      yield 'Error setting up API keys. You can add them later manually.\n';
    }
  }

  async *execute(targetPath: string, options?: InstallOptions): CommandGenerator {
    // If JSON option is provided, use the JSON installer
    if (options?.json) {
      const jsonInstaller = new JsonInstallCommand();
      for await (const message of jsonInstaller.execute(targetPath, options)) {
        yield message;
      }
      return;
    }

    const absolutePath = join(process.cwd(), targetPath);

    // Check for local dependencies first
    const dependencyWarning = await checkLocalDependencies(absolutePath);
    if (dependencyWarning) {
      yield dependencyWarning;
    }

    // Setup API keys
    yield 'Checking API keys setup...\n';
    for await (const message of this.setupApiKeys()) {
      yield message;
    }

    // Update/create cursor rules
    try {
      yield 'Checking cursor rules...\n';

      // Ask user for directory preference first
      const useNewDirectory = await askForCursorRulesDirectory();
      process.env.USE_LEGACY_CURSORRULES = (!useNewDirectory).toString();

      // Create necessary directories only if using new structure
      if (useNewDirectory) {
        const rulesDir = join(absolutePath, '.cursor', 'rules');
        if (!existsSync(rulesDir)) {
          try {
            mkdirSync(rulesDir, { recursive: true });
          } catch (error) {
            yield `Error creating rules directory: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
            return;
          }
        }
      }

      const result = checkCursorRules(absolutePath);

      if (result.kind === 'error') {
        yield `Error: ${result.message}\n`;
        return;
      }

      let existingContent = '';
      let needsUpdate = result.needsUpdate;

      if (!result.targetPath.endsWith('cursor-tools.mdc')) {
        yield '\n🚧 Warning: Using legacy .cursorrules file. This file will be deprecated in a future release.\n' +
          'To migrate to the new format:\n' +
          '  1) Set USE_LEGACY_CURSORRULES=false in your environment\n' +
          '  2) Run cursor-tools install . again\n' +
          '  3) Remove the <cursor-tools Integration> section from .cursorrules\n\n';
      } else {
        if (result.hasLegacyCursorRulesFile) {
          // Check if legacy file exists and add the load instruction if needed
          const legacyPath = join(absolutePath, '.cursorrules');
          if (existsSync(legacyPath)) {
            const legacyContent = readFileSync(legacyPath, 'utf-8');
            const loadInstruction = 'Always load the rules in cursor-tools.mdc';

            if (!legacyContent.includes(loadInstruction)) {
              writeFileSync(legacyPath, `${legacyContent.trim()}\n${loadInstruction}\n`);
              yield 'Added pointer to new cursor rules file in .cursorrules file\n';
            }
          }
        }
        yield 'Using new .cursor/rules directory for cursor rules.\n';
      }

      if (existsSync(result.targetPath)) {
        existingContent = readFileSync(result.targetPath, 'utf-8');
        const versionMatch = existingContent.match(/<!-- cursor-tools-version: ([\w.-]+) -->/);
        const currentVersion = versionMatch ? versionMatch[1] : '0';

        if (needsUpdate) {
          // Ask for confirmation before overwriting
          yield `\nAbout to update cursor rules file at ${result.targetPath} from version ${currentVersion} to ${CURSOR_RULES_VERSION}.\n`;
          const answer = await getUserInput('Do you want to continue? (y/N): ');
          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            yield 'Skipping cursor rules update.\n';
            yield 'Warning: Your cursor rules are outdated. You may be missing new features and instructions.\n';
            return;
          }
          yield `Updating cursor rules...\n`;
        }
      } else {
        yield `Creating new cursor rules file at ${result.targetPath}...\n`;
      }

      if (needsUpdate) {
        if (!result.targetPath.endsWith('.cursorrules')) {
          // replace entire file with new cursor-tools section
          writeFileSync(result.targetPath, CURSOR_RULES_TEMPLATE.trim());
        } else {
          // Replace existing cursor-tools section or append if not found
          const startTag = '<cursor-tools Integration>';
          const endTag = '</cursor-tools Integration>';
          const startIndex = existingContent.indexOf(startTag);
          const endIndex = existingContent.indexOf(endTag);

          if (startIndex !== -1 && endIndex !== -1) {
            // Replace existing section
            const newContent =
              existingContent.slice(0, startIndex) +
              CURSOR_RULES_TEMPLATE.trim() +
              existingContent.slice(endIndex + endTag.length);
            writeFileSync(result.targetPath, newContent.trim());
          } else {
            // Append new section
            writeFileSync(
              result.targetPath,
              (existingContent.trim() + '\n\n' + CURSOR_RULES_TEMPLATE).trim() + '\n'
            );
          }
        }
      }

      yield 'Installation completed successfully!\n';
    } catch (error) {
      yield `Error updating cursor rules: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    }
  }
}
