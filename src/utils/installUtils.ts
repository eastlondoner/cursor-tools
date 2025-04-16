import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { consola } from 'consola';
import { colors } from 'consola/utils';
import type { Provider, Config, CommandGenerator } from '../types';

// Create color bindings with consola colors
export const VIBE_COLORS = {
  main: (text: string) => colors.green(text), // Use green as main color
  dark: (text: string) => colors.greenBright(text),
  light: (text: string) => colors.green(text),
  success: (text: string) => colors.green(text),
  error: (text: string) => colors.red(text),
  warning: (text: string) => colors.yellow(text),
  info: (text: string) => colors.blue(text),
  white: (text: string) => colors.white(text),
  gray: (text: string) => colors.gray(text),
};

// Define directory paths
export const VIBE_HOME_DIR = join(homedir(), '.vibe-tools');
export const VIBE_HOME_ENV_PATH = join(VIBE_HOME_DIR, '.env');
export const VIBE_HOME_CONFIG_PATH = join(VIBE_HOME_DIR, 'config.json');
export const CLAUDE_HOME_DIR = join(homedir(), '.claude'); // Global Claude directory
export const CODEX_HOME_DIR = join(homedir(), '.codex'); // Global Codex directory
export const CODEX_GLOBAL_INSTRUCTIONS_PATH = join(CODEX_HOME_DIR, 'instructions.md'); // Global Codex instructions file
export const CODEX_LOCAL_INSTRUCTIONS_FILENAME = 'codex.md'; // Local Codex instructions filename
export const LOCAL_ENV_PATH = join(process.cwd(), '.vibe-tools.env'); // Keep local path definition separate
export const LOCAL_CONFIG_PATH = join(process.cwd(), 'vibe-tools.config.json'); // Keep local path definition separate

// Valid providers that vibe-tools supports
// Note: The case here is important as it's used to normalize user input to the expected format
export const VALID_PROVIDERS = [
  'Openrouter',
  'Perplexity',
  'Openai',
  'Anthropic',
  'Modelbox',
  'Gemini',
  'xAI',
];
export const VALID_PROVIDERS_LOWERCASE = VALID_PROVIDERS.map((p) => p.toLowerCase());

// Helper function to update or add vibe-tools section in IDE rules files
export function updateRulesSection(filePath: string, rulesTemplate: string): void {
  // Check if file exists and read its content
  let existingContent = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';

  // Replace existing vibe-tools section or append if not found
  const startTag = '<vibe-tools Integration>';
  const endTag = '</vibe-tools Integration>';
  const startIndex = existingContent.indexOf(startTag);
  const endIndex = existingContent.indexOf(endTag);

  if (startIndex !== -1 && endIndex !== -1) {
    // Replace existing section
    const newContent =
      existingContent.slice(0, startIndex) +
      rulesTemplate.trim() +
      existingContent.slice(endIndex + endTag.length);
    writeFileSync(filePath, newContent.trim());
  } else {
    // Append new section
    writeFileSync(filePath, (existingContent.trim() + '\n\n' + rulesTemplate).trim() + '\n');
  }
}

// Helper function for directory creation
export function ensureDirectoryExists(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Clear the console for a clean installation experience
export function clearScreen(): void {
  // Use ANSI escape sequence to clear the screen
  process.stdout.write('\x1Bc');
}

// Write keys to env file with proper handling of existing content
export function writeKeysToFile(filePath: string, keys: Record<string, string>): void {
  let existingEnvVars: Record<string, string> = {};
  if (existsSync(filePath)) {
    try {
      const existingContent = readFileSync(filePath, 'utf-8');
      existingContent.split('\n').forEach((line) => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;

        const eqIndex = line.indexOf('=');
        if (eqIndex !== -1) {
          const key = line.slice(0, eqIndex).trim();
          let value = line.slice(eqIndex + 1).trim();
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          if (key) {
            existingEnvVars[key] = value;
          }
        }
      });
    } catch (error) {
      consola.warn(`Warning: Error reading existing .env file at ${filePath}:`);
      consola.error(error);
    }
  }

  // Merge new keys with existing ones
  const mergedKeys = {
    ...existingEnvVars,
    ...Object.fromEntries(Object.entries(keys).filter(([_, value]) => value)),
  };

  const envContent =
    Object.entries(mergedKeys)
      .map(([key, value]) => {
        const normalizedValue = String(value);
        const escapedValue = normalizedValue.replace(/(?<!\\)"/g, '\\"');
        return `${key}="${escapedValue}"`;
      })
      .join('\n') + '\n';

  const dir = join(filePath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, envContent, 'utf-8');
}

// Helper function to check for local vibe-tools dependencies
export async function checkLocalDependencies(targetPath: string): Promise<string | null> {
  const packageJsonPath = join(targetPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    if (dependencies['vibe-tools'] || devDependencies['vibe-tools']) {
      return `Warning: Found local vibe-tools dependency in package.json. Since vibe-tools is now designed for global installation only, please remove it from your package.json dependencies and run 'npm uninstall vibe-tools', 'pnpm uninstall vibe-tools', or 'yarn remove vibe-tools' to clean up any local installation.\n`;
    }
  } catch (error) {
    console.error('Error reading package.json:', error);
  }
  return null;
}

// Generate the vibe-tools logo ASCII art
export function getVibeToolsLogo(): string {
  return [
    VIBE_COLORS.main('██╗   ██╗██╗██████╗ ███████╗   ████████╗ ██████╗  ██████╗ ██╗     ███████╗'),
    VIBE_COLORS.main('██║   ██║██║██╔══██╗██╔════╝   ╚══██╔══╝██╔═══██╗██╔═══██╗██║     ██╔════╝'),
    VIBE_COLORS.main('██║   ██║██║██████╔╝█████╗        ██║   ██║   ██║██║   ██║██║     ███████╗'),
    VIBE_COLORS.main('╚██╗ ██╔╝██║██╔══██╗██╔══╝        ██║   ██║   ██║██║   ██║██║     ╚════██║'),
    VIBE_COLORS.main(' ╚████╔╝ ██║██████╔╝███████╗      ██║   ╚██████╔╝╚██████╔╝███████╗███████║'),
    VIBE_COLORS.main('  ╚═══╝  ╚═╝╚═════╝ ╚══════╝      ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝╚══════╝'),
    '',
    VIBE_COLORS.main('                        https://vibe-tools.com'),
  ].join('\n');
}

// Collect required providers from config
export function collectRequiredProviders(config: {
  ide?: string;
  coding?: { provider: Provider; model: string };
  websearch?: { provider: Provider; model: string };
  tooling?: { provider: Provider; model: string };
  largecontext?: { provider: Provider; model: string };
}): Provider[] {
  const providers = new Set<Provider>();

  Object.entries(config).forEach(([key, value]) => {
    // Skip the ide key and ensure value has provider property
    if (key === 'ide' || typeof value !== 'object' || !('provider' in value)) return;

    // Add the lowercase provider
    providers.add(value.provider.toLowerCase() as Provider);
  });

  return Array.from(providers);
}

// Parse string values from consola prompt into provider/model objects
export function parseProviderModel(value: string): { provider: Provider; model: string } {
  const [provider, model] = value.split(':');
  // Normalize provider case to match expected format
  const providerIndex = VALID_PROVIDERS_LOWERCASE.indexOf(provider.toLowerCase());
  // Use the lowercase version from VALID_PROVIDERS_LOWERCASE
  const normalizedProvider = VALID_PROVIDERS_LOWERCASE[providerIndex] as Provider;
  return { provider: normalizedProvider, model };
}

// Setup rules for cline/roo IDEs with shared functionality - preserves original behavior
export async function setupClinerules(
  absolutePath: string,
  selectedIde: string,
  generateRules: (ide: string, isMdc?: boolean) => string
): Promise<void> {
  // The remaining code is for cline IDE
  const clinerulePath = join(absolutePath, '.clinerules');

  // Check if this is a legacy file format or already a directory
  let isLegacyFile = false;
  if (existsSync(clinerulePath)) {
    try {
      const stats = statSync(clinerulePath);
      isLegacyFile = stats.isFile();
    } catch (error) {
      consola.error(`Error checking .clinerules:`, error);
    }
  }

  if (isLegacyFile) {
    // Handle legacy .clinerules file format
    const answer = await consola.prompt(
      `Convert to the new .clinerules/ directory format? (recommended)`,
      { type: 'confirm' }
    );

    if (answer === true) {
      try {
        // Convert to directory format
        const legacyContent = readFileSync(clinerulePath, 'utf-8');
        rmSync(clinerulePath);
        mkdirSync(clinerulePath, { recursive: true });

        // Create base.md with legacy content
        const basePath = join(clinerulePath, 'base.md');
        writeFileSync(basePath, legacyContent);

        // Write the vibe-tools rule file
        const rulesPath = join(clinerulePath, 'vibe-tools.md');
        let rulesTemplate = generateRules(selectedIde);
        // Wrap with vibe-tools Integration tags if not already wrapped
        if (!rulesTemplate.includes('<vibe-tools Integration>')) {
          rulesTemplate = `<vibe-tools Integration>\n${rulesTemplate}\n</vibe-tools Integration>`;
        }
        writeFileSync(rulesPath, rulesTemplate);

        consola.success(`Converted .clinerules to directory format successfully`);
      } catch (error) {
        consola.error(`Error during conversion:`, error);
      }
    } else {
      // Keep legacy format, update the file
      const rulesPath = clinerulePath;
      let rulesTemplate = generateRules(selectedIde);
      if (!rulesTemplate.includes('<vibe-tools Integration>')) {
        rulesTemplate = `<vibe-tools Integration>\n${rulesTemplate}\n</vibe-tools Integration>`;
      }
      updateRulesSection(rulesPath, rulesTemplate);
      consola.success(`Updated existing .clinerules file`);
    }
  } else {
    // Handle new directory format or create new directory
    try {
      if (!existsSync(clinerulePath)) {
        mkdirSync(clinerulePath, { recursive: true });
      }

      const rulesPath = join(clinerulePath, 'vibe-tools.md');
      let rulesTemplate = generateRules(selectedIde);
      if (!rulesTemplate.includes('<vibe-tools Integration>')) {
        rulesTemplate = `<vibe-tools Integration>\n${rulesTemplate}\n</vibe-tools Integration>`;
      }
      writeFileSync(rulesPath, rulesTemplate);
      consola.success(`Rules written to ${rulesPath}`);
    } catch (error) {
      consola.error(`Error creating directory structure:`, error);
    }
  }
}

// New function for handling legacy migration
export async function* handleLegacyMigration(): CommandGenerator {
  try {
    const legacyHomeDir = join(homedir(), '.cursor-tools');
    if (existsSync(legacyHomeDir)) {
      consola.info('Detected legacy .cursor-tools directory.');

      const shouldMigrate = await consola.prompt(
        'Do you want to migrate settings from cursor-tools to vibe-tools?',
        { type: 'confirm' }
      );

      if (shouldMigrate) {
        // Ensure vibe-tools directory exists
        ensureDirectoryExists(VIBE_HOME_DIR);

        // Check for and migrate env file
        const legacyEnvPath = join(legacyHomeDir, '.env');
        if (existsSync(legacyEnvPath)) {
          const legacyEnvContent = readFileSync(legacyEnvPath, 'utf-8');
          writeFileSync(VIBE_HOME_ENV_PATH, legacyEnvContent);
          consola.success('Migrated environment variables');
        }

        // Check for and migrate config file
        const legacyConfigPath = join(legacyHomeDir, 'config.json');
        if (existsSync(legacyConfigPath)) {
          try {
            const legacyConfig = JSON.parse(readFileSync(legacyConfigPath, 'utf-8'));

            // Update config with new keys if necessary
            // Ensure default structure exists before assigning legacy values
            const newConfig: Config = {
              web: legacyConfig.web || { provider: 'perplexity' }, // Default provider if missing
              repo: legacyConfig.repo || { provider: 'gemini' }, // Default provider if missing
              plan: legacyConfig.plan || {
                fileProvider: 'gemini', // Default providers if missing
                thinkingProvider: 'openai',
              },
              doc: legacyConfig.doc || { provider: 'perplexity' }, // Default provider if missing
              // Preserve other top-level keys like 'ide' if they exist
              ...(legacyConfig.ide && { ide: legacyConfig.ide.toLowerCase() }), // Lowercase IDE name
            };

            // Explicitly handle nested provider/model mapping if needed,
            // but the structure seems simpler now. Let's keep it direct.

            writeFileSync(VIBE_HOME_CONFIG_PATH, JSON.stringify(newConfig, null, 2));
            consola.success('Migrated configuration file');
          } catch (error) {
            consola.error(`Error migrating config: ${error}`);
            yield `Error migrating config: ${error instanceof Error ? error.message : 'Unknown error'}`; // Yield error message
          }
        }

        yield 'Migration completed successfully.';

        // Ask if user wants to delete the old directory
        const shouldDeleteOld = await consola.prompt(
          'Do you want to delete the old .cursor-tools directory? (recommended)',
          { type: 'confirm' }
        );

        if (shouldDeleteOld) {
          try {
            rmSync(legacyHomeDir, { recursive: true, force: true });
            consola.success('Deleted legacy .cursor-tools directory');
          } catch (error) {
            consola.error(`Error deleting legacy directory: ${error}`);
          }
        }
      } else {
        yield 'Skipping migration.';
      }
    }
  } catch (error) {
    consola.error(`Error during migration: ${error}`);
    yield `Error during migration: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
