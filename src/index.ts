import { commands } from './commands/index.ts';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCursorRules } from './cursorrules.ts';
import type { CommandOptions, Provider } from './types';
import { promises as fsPromises } from 'node:fs';
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
type CLIBooleanOption =
  // Core options
  | 'debug'
  | 'help'
  | 'json'
  // Output options
  | 'quiet'
  // Browser options
  | 'headless'
  | 'console'
  | 'network'
  | 'html';

type CLINumberOption =
  // Core options
  | 'maxTokens'
  // Browser options
  | 'timeout'
  | 'connectTo';

type CLIStringOption =
  // Core options
  | 'model'
  | 'provider'
  // Output options
  | 'output'
  | 'saveTo'
  // Context options
  | 'hint'
  | 'fromGithub'
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
  | 'thinkingModel';

// Main CLI options interface
interface CLIOptions {
  // String options
  model?: string;
  fromGithub?: string;
  output?: string;
  saveTo?: string;
  hint?: string;
  url?: string;
  screenshot?: string;
  viewport?: string;
  selector?: string;
  wait?: string;
  video?: string;
  evaluate?: string;
  // Plan command options
  fileProvider?: string;
  thinkingProvider?: string;
  fileModel?: string;
  thinkingModel?: string;
  // Number options
  maxTokens?: number;
  timeout?: number;
  connectTo?: number;
  // Boolean options
  debug?: boolean;
  quiet?: boolean;
  json?: boolean;
  help?: boolean;
  console?: boolean;
  html?: boolean;
  network?: boolean;
  headless?: boolean;
}

type CLIOptionKey = CLIStringOption | CLINumberOption | CLIBooleanOption;

// Map of normalized keys to their option names in the options object
const OPTION_KEYS: Record<string, CLIStringOption | CLINumberOption | CLIBooleanOption> = {
  // Core options
  model: 'model',
  provider: 'provider',
  maxtokens: 'maxTokens',
  debug: 'debug',
  help: 'help',
  json: 'json',

  // Output options
  output: 'output',
  saveto: 'saveTo',
  quiet: 'quiet',

  // Context options
  hint: 'hint',
  fromgithub: 'fromGithub',

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

  // Plan options
  fileprovider: 'fileProvider',
  thinkingprovider: 'thinkingProvider',
  filemodel: 'fileModel',
  thinkingmodel: 'thinkingModel',
};

// Set of option keys that are boolean flags
const BOOLEAN_OPTIONS = new Set<CLIBooleanOption>([
  'debug',
  'help',
  'json',
  'quiet',
  'headless',
  'console',
  'network',
  'html',
]);

// Set of option keys that require numeric values
const NUMERIC_OPTIONS = new Set<CLINumberOption>(['maxTokens', 'timeout', 'connectTo']);

async function main() {
  const args = process.argv.slice(2);
  const options: Partial<CommandOptions> = {
    debug: false,
    quiet: false,
    json: false,
    help: false,
  };
  const queryArgs: string[] = [];
  let command: string | undefined;

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!command && !arg.startsWith('--')) {
      command = arg;
      continue;
    }
    if (arg.startsWith('--')) {
      // Handle both --key=value and --key value formats
      let key: string;
      let value: string | undefined;
      const isNoPrefix = arg.startsWith('--no-');

      if (isNoPrefix) {
        key = arg.slice(5); // Remove '--no-'
        value = 'false';
      } else {
        const equalsIndex = arg.indexOf('=');
        if (equalsIndex !== -1) {
          key = arg.slice(2, equalsIndex);
          value = arg.slice(equalsIndex + 1);
        } else {
          key = arg.slice(2);
        }

        // Handle boolean options
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
        (options as any)[optionKey] = num;
        continue;
      }

      if (BOOLEAN_OPTIONS.has(optionKey as CLIBooleanOption)) {
        (options as any)[optionKey] = value === 'true';
      } else if (value !== undefined && optionKey) {
        (options as any)[optionKey] = value;
      }
    } else {
      queryArgs.push(arg);
    }
  }

  if (!command) {
    // If --help is provided without a command, show general help
    if (options.help) {
      command = 'help';
    } else {
      console.error(
        'Usage: cursor-tools [--model=<model>] [--max-tokens=<number>] [--from-github=<github_url>] [--output=<filepath>] [--save-to=<filepath>] [--hint=<hint>] <command> "<query>"\n' +
          '       Note: Options can be specified in kebab-case (--max-tokens) or camelCase (--maxTokens)\n' +
          '       Both --key=value and --key value formats are supported'
      );
      process.exit(1);
    }
  }

  // If --help is provided with a command, show help for that command
  if (options.help && command !== 'help') {
    const originalCommand = command;
    command = 'help';
    queryArgs.unshift(originalCommand);
  }

  const query = command === 'install' && queryArgs.length === 0 ? '.' : queryArgs.join(' ');

  if (!query) {
    if (command === 'doc' || command === 'help') {
      // no query for doc and help commands is ok
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
      ...options as CommandOptions,
      debug: options.debug ?? false,
      provider: options.provider as Provider,
      fileProvider: options.fileProvider as Provider,
      thinkingProvider: options.thinkingProvider as Provider,
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
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
