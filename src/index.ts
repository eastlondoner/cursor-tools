import { commands } from './commands/index.ts';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCursorRules } from './cursorrules.ts';
import type { CommandOptions, Provider } from './types';
import { reasoningEffortSchema } from './types';
import { promises as fsPromises } from 'node:fs';
import { trackEvent } from './telemetry';
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

async function main() {
  const startTime = Date.now(); // Start timer
  const [, , command, ...args] = process.argv;

  // Handle version command
  if (command === 'version' || command === '-v' || command === '--version') {
    try {
      const packageJsonPath = join(__dirname, '../package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      console.log(`vibe-tools version ${packageJson.version}`);
      process.exit(0);
    } catch {
      console.error('Error: Could not read package version');
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
  };
  const queryArgs: string[] = [];

  let commandName: string | undefined = undefined;
  let subCommandName: string | undefined = undefined;

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
    console.error(
      'Usage: vibe-tools [--model=<model>] [--max-tokens=<number>] [--from-github=<github_url>] [--output=<filepath>] [--save-to=<filepath>] [--hint=<hint>] <command> "<query>"\n' +
        '       Note: Options can be specified in kebab-case (--max-tokens) or camelCase (--maxTokens)\n' +
        '       Both --key=value and --key value formats are supported'
    );
    process.exit(1);
  }

  if (!query) {
    if (command === 'doc') {
      // no query for doc command is ok
    } else {
      console.error(`Error: No query provided for command: ${command}`);
      process.exit(1);
    }
  }

  const commandHandler = commands[command];
  if (!commandHandler) {
    console.error(`Unknown command: ${command}`);
    console.error(`Available commands: ${Object.keys(commands).join(', ')}`);
    process.exit(1);
  }

  // Check .cursorrules version unless running the install command
  if (command !== 'install') {
    const result = checkCursorRules(process.cwd());
    if (result.kind === 'success' && result.needsUpdate && result.message) {
      console.error('\x1b[33m%s\x1b[0m', `Warning: ${result.message}`); // Yellow text
    } else if (result.kind === 'error') {
      console.error('\x1b[31m%s\x1b[0m', `Error: ${result.message}`); // Red text
    }
  }

  commandName = command; // Assign commandName here

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

    // Track successful execution
    const durationMs = Date.now() - startTime;
    // Collect flags and their values
    const commandFlags = Object.entries(options)
      .filter(
        ([key, value]) =>
          value !== undefined && value !== false && OPTION_KEYS[normalizeArgKey(key)]
      ) // Ensure it's a valid option
      .reduce(
        (acc, [key, value]) => {
          acc[toKebabCase(key)] = value;
          return acc;
        },
        {} as Record<string, any>
      );

    const telemetryProps: Record<string, any> = {
      command: commandName,
      duration_ms: durationMs,
      status: 'success',
      command_flags: commandFlags, // Use command_flags object
      provider_used: commandOptions.provider,
      model_used: commandOptions.model,
    };
    if (subCommandName) {
      telemetryProps.subcommand = subCommandName;
    }

    // Await the telemetry event but catch errors so they don't crash the process
    try {
      await trackEvent('command_executed', telemetryProps, options.debug);
    } catch (telemetryError) {
      // Log telemetry errors only if debug flag is enabled
      if (options.debug) {
        console.error('Telemetry error during command_executed:', telemetryError);
      }
    }

    process.exit(0);
  } catch (error: any) {
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

    // Track command error
    const durationMs = Date.now() - startTime;
    // Collect flags and their values for errors
    const errorCommandFlags = Object.entries(options)
      .filter(
        ([key, value]) =>
          value !== undefined && value !== false && OPTION_KEYS[normalizeArgKey(key)]
      ) // Ensure it's a valid option
      .reduce(
        (acc, [key, value]) => {
          acc[toKebabCase(key)] = value;
          return acc;
        },
        {} as Record<string, any>
      );

    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    const errorMessage = error instanceof Error ? error.message : String(error);

    const errorTelemetryProps: Record<string, any> = {
      command: commandName || 'unknown',
      duration_ms: durationMs,
      status: 'error',
      error_type: errorType,
      error_message: errorMessage.substring(0, 256), // Truncate long messages
      command_flags: errorCommandFlags, // Use command_flags object for errors
      provider_used: options.provider,
      model_used: options.model,
    };
    if (subCommandName) {
      errorTelemetryProps.subcommand = subCommandName;
    }

    // Await the telemetry event but catch errors so they don't crash the process
    try {
      await trackEvent('command_error', errorTelemetryProps, options.debug);
    } catch (telemetryError) {
      // Log telemetry errors only if debug flag is enabled
      if (options.debug) {
        console.error('Telemetry error during command_error:', telemetryError);
      }
    }

    process.exit(1);
  }
}

// Use void to explicitly ignore the unhandled promise from main()
void main();
