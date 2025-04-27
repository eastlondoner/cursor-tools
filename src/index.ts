import { commands } from './commands/index.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isRulesContentUpToDate,
  checkFileForVibeTag,
  updateProjectRulesFile,
  getConfiguredIde,
} from './vibe-rules';
import { checkPackageVersion, getCurrentVersion } from './utils/versionUtils';
import type { CommandOptions, Provider } from './types';
import { reasoningEffortSchema } from './types';
import { promises as fsPromises } from 'node:fs';
import consola from 'consola';
import { spawn } from 'node:child_process';
// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Helper function to normalize argument keys
function normalizeArgKey(key: string): string {
  // Convert from kebab-case to lowercase without hyphens
  return key.toLowerCase().replace(/-/g, '');
}

// Helper function to convert camelCase to kebab-case
function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// CLI option types
type CLIStringOption =
  // Core options
  | 'model'
  | 'provider'
  | 'reasoningEffort'
  // Output options
  | 'output'
  | 'saveTo'
  | 'json'
  // Context options
  | 'hint'
  | 'fromGithub'
  | 'subdir'
  | 'withDoc'
  // Browser options
  | 'url'
  | 'screenshot'
  | 'viewport'
  | 'selector'
  | 'wait'
  | 'video'
  | 'evaluate'
  // Plan options
  | 'fileProvider'
  | 'thinkingProvider'
  | 'fileModel'
  | 'thinkingModel'
  // YouTube options
  | 'type'
  | 'format'
  // Test options
  | 'scenarios';

type CLINumberOption =
  // Core options
  | 'maxTokens'
  // Browser options
  | 'timeout'
  | 'connectTo'
  // Test options
  | 'parallel';

type CLIBooleanOption =
  // Core options
  | 'debug'
  // Output options
  | 'quiet'
  // Browser options
  | 'console'
  | 'html'
  | 'network'
  | 'headless'
  | 'text';

// Main CLI options interface
interface CLIOptions {
  // Core options
  model?: string;
  provider?: string;
  maxTokens?: number;
  debug?: boolean;
  reasoningEffort?: string;

  // Output options
  output?: string;
  saveTo?: string;
  quiet?: boolean;
  json?: boolean | string;

  // Context options
  hint?: string;
  fromGithub?: string;
  subdir?: string;
  withDoc?: string;

  // Browser options
  url?: string;
  screenshot?: string;
  viewport?: string;
  selector?: string;
  wait?: string;
  video?: string;
  evaluate?: string;
  timeout?: number;
  connectTo?: number;
  console?: boolean;
  html?: boolean;
  network?: boolean;
  headless?: boolean;
  text?: boolean;

  // Plan options
  fileProvider?: string;
  thinkingProvider?: string;
  fileModel?: string;
  thinkingModel?: string;

  // YouTube options
  type?: string;
  format?: string;

  // Test options
  parallel?: number;
  scenarios?: string;
}

type CLIOptionKey = CLIStringOption | CLINumberOption | CLIBooleanOption;

// Map of normalized keys to their option names in the options object
const OPTION_KEYS: Record<string, CLIOptionKey> = {
  // Core options
  model: 'model',
  provider: 'provider',
  maxtokens: 'maxTokens',
  debug: 'debug',
  reasoningeffort: 'reasoningEffort',

  // Output options
  output: 'output',
  saveto: 'saveTo',
  quiet: 'quiet',
  json: 'json',

  // Context options
  hint: 'hint',
  fromgithub: 'fromGithub',
  subdir: 'subdir',
  withdoc: 'withDoc',

  // Browser options
  url: 'url',
  screenshot: 'screenshot',
  viewport: 'viewport',
  selector: 'selector',
  wait: 'wait',
  video: 'video',
  evaluate: 'evaluate',
  timeout: 'timeout',
  connectto: 'connectTo',
  console: 'console',
  html: 'html',
  network: 'network',
  headless: 'headless',
  text: 'text',

  // Plan options
  fileprovider: 'fileProvider',
  thinkingprovider: 'thinkingProvider',
  filemodel: 'fileModel',
  thinkingmodel: 'thinkingModel',

  // YouTube options
  type: 'type',
  format: 'format',

  // Test options
  parallel: 'parallel',
  scenarios: 'scenarios',
};

// Set of option keys that are boolean flags
const BOOLEAN_OPTIONS = new Set<CLIBooleanOption>([
  'debug',
  'quiet',
  'console',
  'html',
  'network',
  'headless',
  'text',
]);

// Set of option keys that require numeric values
const NUMERIC_OPTIONS = new Set<CLINumberOption>(['maxTokens', 'timeout', 'connectTo', 'parallel']);

// --- CORRECTED HELPER FUNCTION for Rules Check ---
async function performRulesCheck(): Promise<{ ide: string; path: string; reason: string }[]> {
  const targetDir = process.cwd();
  const filesToUpdate: { ide: string; path: string; reason: string }[] = [];

  // Get the IDE configured in vibe-tools config (local or global)
  const configuredIde = getConfiguredIde(targetDir); // <-- Get configured IDE

  // Define potential IDE integrations and their properties
  const potentialIntegrations = [
    { ide: 'cursor', requiresTag: false },
    { ide: 'windsurf', requiresTag: true },
    { ide: 'cline', requiresTag: false }, // Also handles 'roo'
    { ide: 'claude-code', requiresTag: true },
    { ide: 'codex', requiresTag: true },
  ];

  // If no IDE is configured, we can't reliably check rules this way.
  // The install command should handle initial setup.
  if (!configuredIde) {
    // consola.debug('No IDE configured in vibe-tools.config.json, skipping automatic rule check.');
    return filesToUpdate; // Return empty list
  }

  // Find the specific integration matching the configured IDE
  const currentIntegration = potentialIntegrations.find((int) => int.ide === configuredIde);

  // If the configured IDE isn't one we know how to check, exit
  if (!currentIntegration) {
    // consola.debug(`Configured IDE '${configuredIde}' not recognized for rule check.`);
    return filesToUpdate;
  }

  const { ide, requiresTag: requiresTagCheck } = currentIntegration;

  try {
    let needsUpdate = false;
    let updateReason = '';
    let checkedPath: string | undefined; // Store the path determined by isRulesContentUpToDate

    // 1. Check if rules are up-to-date (this also handles file existence)
    const updateCheck = isRulesContentUpToDate(targetDir, ide);
    checkedPath = updateCheck.path; // Store the path it checked

    if (updateCheck.needsUpdate) {
      needsUpdate = true;
      updateReason = updateCheck.message || 'outdated version or file missing';
    } else if (requiresTagCheck) {
      // 2. Only if up-to-date AND requires tag check, check for the tag
      if (!checkFileForVibeTag(targetDir, ide)) {
        needsUpdate = true;
        // Use checkedPath for a more specific message if available
        updateReason = `missing Vibe Tools integration tag${checkedPath ? ' in ' + checkedPath : ''}`;
      }
    }

    // 3. If an update is needed for any reason, add to the list
    if (needsUpdate && checkedPath) {
      filesToUpdate.push({ ide, path: checkedPath, reason: updateReason });
    } else if (needsUpdate && !checkedPath) {
      // Fallback, though should ideally always have path from updateCheck
      consola.warn(`Update needed for ${ide} but path couldn't be determined.`);
    }
  } catch (error: any) {
    // Catch errors from the check functions themselves (e.g., permission issues)
    consola.warn(`Could not perform rules check for ${ide}: ${error.message}`);
  }

  return filesToUpdate; // Return the list
}

async function main() {
  const originalArgs = process.argv.slice(2); // Store original args
  const [command, ...args] = originalArgs;

  // Handle version command next
  if (command === 'version' || command === '-v' || command === '--version') {
    try {
      const currentVersion = getCurrentVersion();
      if (currentVersion === '0.0.0') {
        console.error('Error: Could not determine package version using versionUtils.');
        process.exit(1);
      }
      console.log(`vibe-tools version ${currentVersion}`);
      process.exit(0);
    } catch (error) {
      console.error(
        'Error retrieving package version:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  }

  // Parse options from args
  const options: CLIOptions = {
    // String options
    model: undefined,
    fromGithub: undefined,
    output: undefined,
    saveTo: undefined,
    hint: undefined,
    url: undefined,
    screenshot: undefined,
    viewport: undefined,
    selector: undefined,
    wait: undefined,
    video: undefined,
    evaluate: undefined,
    // Plan command options
    fileProvider: undefined,
    thinkingProvider: undefined,
    fileModel: undefined,
    thinkingModel: undefined,
    // Number options
    maxTokens: undefined,
    timeout: undefined,
    connectTo: undefined,
    parallel: undefined,
    // Boolean options
    console: undefined,
    html: undefined,
    network: undefined,
    headless: undefined,
    text: undefined,
    debug: undefined,
    quiet: undefined,
    json: undefined,
    reasoningEffort: undefined,
    subdir: undefined,
    withDoc: undefined,
  };
  const queryArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      // Handle both --key=value and --key value formats
      let key: string;
      let value: string | undefined;

      const equalIndex = arg.indexOf('=');
      if (equalIndex !== -1) {
        // --key=value format
        key = arg.slice(2, equalIndex);
        value = arg.slice(equalIndex + 1);
      } else {
        let isNoPrefix = false;
        // Check for --no- prefix
        if (arg.startsWith('--no-')) {
          // --no-key format for boolean options
          key = arg.slice(5); // Remove --no- prefix
          const normalizedKey = normalizeArgKey(key.toLowerCase());
          const optionKey = OPTION_KEYS[normalizedKey];
          if (BOOLEAN_OPTIONS.has(optionKey as CLIBooleanOption)) {
            value = 'false'; // Implicitly set boolean flag to false
            isNoPrefix = true;
          } else {
            key = arg.slice(2); // Treat as normal key if not a boolean option
          }
        } else {
          // --key value format
          key = arg.slice(2);
        }

        // For boolean flags without --no- prefix, check next argument for explicit true/false
        const normalizedKey = normalizeArgKey(key.toLowerCase());
        const optionKey = OPTION_KEYS[normalizedKey];
        if (!isNoPrefix && BOOLEAN_OPTIONS.has(optionKey as CLIBooleanOption)) {
          // Check if next argument is 'true' or 'false'
          if (i + 1 < args.length && ['true', 'false'].includes(args[i + 1].toLowerCase())) {
            value = args[i + 1].toLowerCase();
            i++; // Skip the next argument since we've used it as the value
          } else {
            value = 'true'; // Default to true if no explicit value
          }
        } else if (!isNoPrefix) {
          // For non-boolean options, look for a value
          if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
            value = args[i + 1];
            i++; // Skip the next argument since we've used it as the value
          }
        }
      }

      // Normalize and validate the key
      const normalizedKey = normalizeArgKey(key.toLowerCase());
      const optionKey = OPTION_KEYS[normalizedKey];

      if (!optionKey) {
        console.error(`Error: Unknown option '--${key}'`);
        console.error(
          'Available options:',
          Array.from(new Set(Object.values(OPTION_KEYS)))
            .map((k) => `--${toKebabCase(k)}`)
            .join(', ')
        );
        process.exit(1);
      }

      // Special handling for --json option for install command
      if (
        optionKey === 'json' &&
        command === 'install' &&
        value !== 'true' &&
        value !== 'false' &&
        value !== undefined
      ) {
        options[optionKey] = value;
        continue;
      }

      if (value === undefined && !BOOLEAN_OPTIONS.has(optionKey as CLIBooleanOption)) {
        console.error(`Error: No value provided for option '--${key}'`);
        process.exit(1);
      }

      if (NUMERIC_OPTIONS.has(optionKey as CLINumberOption)) {
        const num = Number.parseInt(value || '', 10);
        if (Number.isNaN(num)) {
          console.error(`Error: ${optionKey} must be a number`);
          process.exit(1);
        }
        // Special validation for parallel option
        if (optionKey === 'parallel' && num < 1) {
          console.error(`Error: parallel must be a positive number`);
          process.exit(1);
        }
        options[optionKey as CLINumberOption] = num;
        continue;
      }

      if (BOOLEAN_OPTIONS.has(optionKey as CLIBooleanOption)) {
        options[optionKey as CLIBooleanOption] = value === 'true';
      } else if (value !== undefined && optionKey) {
        options[optionKey as CLIStringOption] = value;
      }
    } else {
      queryArgs.push(arg);
    }
  }

  const query = command === 'install' && queryArgs.length === 0 ? '.' : queryArgs.join(' ');

  if (!command) {
    consola.error('Error: No command provided.');
    consola.error(`Available commands: ${Object.keys(commands).join(', ')}`);
    process.exit(1);
  }

  if (!query) {
    if (command === 'doc') {
      // no query for doc command is ok
    } else {
      consola.error(`Error: No query provided for command: ${command}`);
      process.exit(1);
    }
  }

  const commandHandler = commands[command];
  if (!commandHandler) {
    consola.error(`Unknown command: ${command}`);
    consola.error(`Available commands: ${Object.keys(commands).join(', ')}`);
    process.exit(1);
  }

  // --- Start Update Check Block ---
  let shouldContinueExecution = true;

  try {
    const versionInfo = await checkPackageVersion();
    if (versionInfo.isOutdated && versionInfo.latest) {
      // Inform the user about the automatic update
      consola.info(
        `New version v${versionInfo.latest} available (you have v${versionInfo.current}). Automatically updating...`
      );

      // Explicitly ask user for package manager
      const selectedPackageManager = await consola.prompt('Select package manager for update:', {
        type: 'select',
        options: ['npm', 'bun', 'yarn', 'pnpm'],
        initial: 'npm', // Default suggestion
      });

      let pmCommand: string;
      let pmArgs: string[];

      switch (selectedPackageManager) {
        case 'yarn':
          pmCommand = 'yarn';
          pmArgs = ['global', 'add', 'vibe-tools@latest'];
          break;
        case 'pnpm':
          pmCommand = 'pnpm';
          pmArgs = ['add', '-g', 'vibe-tools@latest'];
          break;
        case 'bun':
          pmCommand = 'bun';
          pmArgs = ['i', '-g', 'vibe-tools@latest'];
          break;
        case 'npm':
        default:
          pmCommand = 'npm';
          pmArgs = ['i', '-g', 'vibe-tools@latest'];
          break;
      }

      consola.info(
        `Updating vibe-tools to v${versionInfo.latest} using ${selectedPackageManager}...`
      );
      shouldContinueExecution = false; // Don't execute original command yet

      const updateProcess = spawn(pmCommand, pmArgs, {
        stdio: 'inherit',
        shell: true,
      });

      updateProcess.on('close', async (code) => {
        if (code === 0) {
          consola.success(`Successfully updated vibe-tools to v${versionInfo.latest}.`);

          // --- MOVED Rules Check / Auto Update START ---
          // We run this *after* the update succeeds
          const filesRequiringUpdate = await performRulesCheck();

          if (filesRequiringUpdate.length > 0) {
            consola.info(
              `Detected ${filesRequiringUpdate.length} outdated IDE integration file(s). Attempting updates...`
            );
            for (const fileToUpdate of filesRequiringUpdate) {
              try {
                const updateResult = await updateProjectRulesFile(process.cwd(), fileToUpdate.ide);
                if (updateResult.updated) {
                  consola.success(
                    `Successfully updated ${fileToUpdate.ide} integration file (${updateResult.path})`
                  );
                } else if (updateResult.error) {
                  consola.error(
                    `Failed to update ${fileToUpdate.ide} integration file (${fileToUpdate.path}): ${updateResult.error.message}`
                  );
                } else {
                  // Not updated, but no error (e.g., already up-to-date, file created, etc.)
                  consola.info(
                    `Checked ${fileToUpdate.ide} integration file (${fileToUpdate.path}). No update applied (${updateResult.reason || 'unknown reason'}).`
                  );
                }
              } catch (error: any) {
                consola.error(
                  `Error during update attempt for ${fileToUpdate.ide} (${fileToUpdate.path}): ${error.message}`
                );
              }
            }
          }
          // --- MOVED Rules Check / Auto Update END ---

          // Special handling for 'install' command
          if (command === 'install') {
            // Adjusted prompt message since we removed the automatic update attempt
            const promptText = `vibe-tools update complete. Still proceed with install (config setup, etc.)?`;
            const proceedWithInstall = await consola.prompt(promptText, {
              type: 'confirm',
              initial: false, // Default to not re-running install actions
            });
            if (proceedWithInstall) {
              consola.info('Proceeding with original install command...');
              const rerunProcess = spawn('vibe-tools', originalArgs, {
                stdio: 'inherit',
                shell: true,
              });
              rerunProcess.on('close', (rerunCode) => process.exit(rerunCode ?? 1));
              rerunProcess.on('error', (err) => {
                consola.error('Failed to re-run install command:', err);
                process.exit(1);
              });
            } else {
              consola.info('Update done. Exiting.');
              process.exit(0); // Exit cleanly, update was the goal
            }
          } else {
            // Re-run the original command for non-install commands
            consola.info('Re-running original command...');
            const rerunProcess = spawn('vibe-tools', originalArgs, {
              stdio: 'inherit',
              shell: true,
            });
            rerunProcess.on('close', (rerunCode) => process.exit(rerunCode ?? 1));
            rerunProcess.on('error', (err) => {
              consola.error('Failed to re-run original command:', err);
              process.exit(1);
            });
          }
        } else {
          consola.error(`Failed to update vibe-tools (exit code: ${code}).`);
          consola.warn('Continuing with the current version...');
          shouldContinueExecution = true; // Allow original command to run
        }
      });

      updateProcess.on('error', (err) => {
        consola.error('Failed to start update process:', err);
        consola.warn('Continuing with the current version...');
        shouldContinueExecution = true; // Allow original command to run
      });
    }
  } catch (error) {
    consola.warn('Could not check for vibe-tools updates:', error);
    // Continue execution even if update check fails
  }
  // --- End Update Check Block ---

  // Only proceed if the update process didn't take over AND exit
  if (shouldContinueExecution) {
    try {
      // If saveTo is specified, ensure the directory exists and clear any existing file
      if (options.saveTo) {
        const dir = dirname(options.saveTo);
        if (dir !== '.') {
          try {
            mkdirSync(dir, { recursive: true });
          } catch (err) {
            console.error(`Error creating directory: ${dir}`, err);
            console.error('Output will not be saved to file.');
            options.saveTo = undefined;
          }
        }
        // Clear the file if it exists
        if (options.saveTo) {
          // Additional check after potential undefined assignment above
          try {
            writeFileSync(options.saveTo, '');
          } catch (err) {
            console.error(`Error clearing file: ${options.saveTo}`, err);
            console.error('Output will not be saved to file.');
            options.saveTo = undefined;
          }
        }
      }

      // Execute the command and handle output
      const commandOptions: CommandOptions = {
        ...options,
        debug: options.debug ?? false,
        provider: options.provider as Provider,
        fileProvider: options.fileProvider as Provider,
        thinkingProvider: options.thinkingProvider as Provider,
        reasoningEffort: options.reasoningEffort
          ? reasoningEffortSchema.parse(options.reasoningEffort)
          : undefined,
      };
      for await (const output of commandHandler.execute(query, commandOptions)) {
        // Only write to stdout if not in quiet mode
        let writePromise: Promise<void>;
        if (!options.quiet) {
          writePromise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout writing to stdout'));
            }, 10000);
            process.stdout.write(output, () => {
              clearTimeout(timeout);
              resolve();
            });
          });
          await writePromise;
        } else {
          writePromise = Promise.resolve();
        }

        if (options.saveTo) {
          try {
            await fsPromises.appendFile(options.saveTo, output);
          } catch (err) {
            console.error(`Error writing to file: ${options.saveTo}`, err);
            // Disable file writing for subsequent outputs
            options.saveTo = undefined;
          }
        }
        await writePromise;
      }
      // this should flush stderr and stdout and write a newline
      console.log('');
      console.error('');

      if (options.saveTo) {
        console.log(`Output saved to: ${options.saveTo}`);
      }
    } catch (error) {
      // Use the formatUserMessage method for CursorToolsError instances to display provider errors
      if (
        error &&
        typeof error === 'object' &&
        'formatUserMessage' in error &&
        typeof error.formatUserMessage === 'function'
      ) {
        console.error('Error:', error.formatUserMessage(options.debug));
      } else {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
      process.exit(1);
    }
  }
}

main()
  .then(() => {
    // Avoid double exit if update flow handled exit already
    // The logic inside the update flow now explicitly calls process.exit()
    // so we might not need to exit here if shouldContinueExecution is false.
    // However, the main command execution block might finish normally.
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
