import type { Command, CommandGenerator, CommandOptions } from '../types.ts';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadEnv } from '../config.ts';
import { CURSOR_RULES_TEMPLATE, CURSOR_RULES_VERSION, checkCursorRules } from '../cursorrules.ts';

interface InstallOptions extends CommandOptions {
  packageManager?: 'npm' | 'yarn' | 'pnpm';
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

export class InstallCommand implements Command {
  private async *setupApiKeys(): CommandGenerator {
    loadEnv(); // Load existing env files if any

    const homeEnvPath = join(homedir(), '.cursor-tools', '.env');
    const localEnvPath = join(process.cwd(), '.cursor-tools.env');

    // Check if keys are already set
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

    // For Stagehand, we need either OpenAI or Anthropic
    const hasStagehandProvider = hasOpenAI || hasAnthropic;

    if (hasPerplexity && hasGemini && (hasStagehandProvider || process.env.SKIP_STAGEHAND)) {
      return;
    }

    // Function to write keys to a file
    const writeKeysToFile = (filePath: string, keys: Record<string, string>) => {
      const envContent =
        Object.entries(keys)
          .filter(([_, value]) => value) // Only include keys with values
          .map(([key, value]) => `${key}=${value}`)
          .join('\n') + '\n';

      const dir = join(filePath, '..');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(filePath, envContent, 'utf-8');
    };

    // Try to write to home directory first, fall back to local if it fails
    try {
      const keys: Record<string, string> = {
        PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
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
    const packageManager = options?.packageManager || 'npm/yarn/pnpm';
    const absolutePath = join(process.cwd(), targetPath);

    // 1. Add cursor-tools to package.json as a dev dependency if it exists
    const packageJsonPath = join(absolutePath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        const currentVersion =
          packageJson.devDependencies?.['cursor-tools'] ||
          packageJson.dependencies?.['cursor-tools'];

        if (currentVersion === 'latest') {
          yield 'cursor-tools is already installed at latest version.\n';
        } else if (currentVersion) {
          yield `Found cursor-tools version ${currentVersion}. Would you like to update to latest? (y/N): `;
          const answer = await getUserInput('');

          if (answer === 'y' || answer === 'yes') {
            if (!packageJson.devDependencies) {
              packageJson.devDependencies = {};
            }
            packageJson.devDependencies['cursor-tools'] = 'latest';
            // Remove from dependencies if it exists there
            if (packageJson.dependencies?.['cursor-tools']) {
              delete packageJson.dependencies['cursor-tools'];
            }
            writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
            yield `Updated cursor-tools to latest version. Please run \`${packageManager} install\` to complete the update.\n`;
          } else {
            yield 'Keeping current version.\n';
          }
        } else {
          const answer = await getUserInput(
            'Would you like to add cursor-tools as a dev dependency to package.json? (y/N): '
          );

          if (answer === 'y' || answer === 'yes') {
            yield 'Adding cursor-tools as a dev dependency to package.json...\n';
            if (!packageJson.devDependencies) {
              packageJson.devDependencies = {};
            }
            packageJson.devDependencies['cursor-tools'] = 'latest';
            writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
            yield `Please run \`${packageManager} install\` to complete the installation.\n`;
          } else {
            yield 'Skipping dev dependency installation.\n';
          }
        }
      } catch (error) {
        yield `Error updating package.json: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
        return;
      }
    } else {
      yield 'No package.json found - skipping dependency installation\n';
    }

    // 2. Create necessary directories first
    const rulesDir = join(absolutePath, '.cursor', 'rules');
    if (!existsSync(rulesDir)) {
      try {
        mkdirSync(rulesDir, { recursive: true });
      } catch (error) {
        yield `Error creating rules directory: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
        return;
      }
    }

    // 3. Setup API keys
    yield 'Checking API keys setup...\n';
    for await (const message of this.setupApiKeys()) {
      yield message;
    }

    // 4. Update/create cursor rules
    try {
      yield 'Checking cursor rules...\n';
      const result = checkCursorRules(absolutePath);

      if (result.kind === 'error') {
        yield `Error: ${result.message}\n`;
        return;
      }

      let existingContent = '';
      let needsUpdate = result.needsUpdate;

      if (result.hasLegacyCursorRulesFile) {
        yield '\n🚧 Warning: Legacy .cursorrules detected. This file will be deprecated in a future release. To migrate:\n' +
          '  1) Move your rules to .cursor/rules/cursor-tools.mdc\n' +
          '  2) Delete .cursorrules\n\n';
      }

      if (existsSync(result.targetPath)) {
        existingContent = readFileSync(result.targetPath, 'utf-8');

        // Check if cursor-tools section exists and version matches
        const startTag = '<cursor-tools Integration>';
        const endTag = '</cursor-tools Integration>';
        const versionMatch = existingContent.match(/<!-- cursor-tools-version: ([\w.-]+) -->/);
        const currentVersion = versionMatch ? versionMatch[1] : '0';

        if (
          existingContent.includes(startTag) &&
          existingContent.includes(endTag) &&
          currentVersion === CURSOR_RULES_VERSION
        ) {
          needsUpdate = false;
          yield 'Cursor rules are up to date.\n';
        } else {
          yield `Updating cursor rules from version ${currentVersion} to ${CURSOR_RULES_VERSION}...\n`;
        }
      } else {
        yield `Creating new cursor rules file at ${result.targetPath}...\n`;
      }

      if (needsUpdate) {
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
          writeFileSync(result.targetPath, newContent);
        } else {
          // Append new section
          writeFileSync(result.targetPath, existingContent + CURSOR_RULES_TEMPLATE);
        }
      }

      yield 'Installation completed successfully!\n';
    } catch (error) {
      yield `Error updating cursor rules: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    }
  }
}
