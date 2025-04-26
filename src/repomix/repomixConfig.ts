import path from 'node:path';
import type { RepomixConfig, pack } from 'repomix';
import { readFile, stat } from 'node:fs/promises';

type RepomixConfigMerged = Parameters<typeof pack>[1];
export const ignorePatterns = [
  //'**/.!(cursor)/**', // negations in ignores do not work correctly
  '.*.*', // ignore dot files - we cannot add an ignore on `.*` because it will cause .cursor to be ignored
  '**/*.pbxproj',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/compile/**',
  '**/*.spec.*',
  '**/*.pyc',
  '**/.env',
  '**/.env.*',
  '**/*.env',
  '**/*.env.*',
  '**/*.lock',
  '**/*.lockb',
  '**/package-lock.*',
  '**/pnpm-lock.*',
  '**/*.tsbuildinfo',
];

export const includePatterns = [
  '**/*',
  '.cursorrules',
  '.cursor/rules/*',
  '.clinerules',
  'CLAUDE.md',
];

export const outputOptions = {
  git: {
    sortByChanges: true,
    sortByChangesMaxCommits: 10,
  },
  compress: false,
  style: 'xml',
  files: true,
  fileSummary: true,
  directoryStructure: true,
  removeComments: false,
  removeEmptyLines: true,
  topFilesLength: 20,
  showLineNumbers: false,
  copyToClipboard: false,
  includeEmptyDirectories: true,
  parsableStyle: false,
} as const;

const defaultConfigPath = 'repomix.config.json';

function getGlobalConfigPath() {
  // get from the home directory on windows or linux
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    return null;
  }
  return path.resolve(homeDir, defaultConfigPath);
}

const defaultConfig = {
  input: {
    maxFileSize: 1_000_000,
  },
  output: outputOptions,
  include: includePatterns,
  ignore: {
    useGitignore: true,
    useDefaultPatterns: true,
    customPatterns: ignorePatterns,
  },
  security: {
    enableSecurityCheck: true,
  },
  tokenCount: {
    encoding: 'o200k_base',
  },
} as const;

export const loadFileConfigWithOverrides = async (
  rootDir: string,
  overrides: Partial<RepomixConfig>
): Promise<RepomixConfigMerged> => {
  let configPath = defaultConfigPath;

  const fullPath = path.resolve(rootDir, configPath);

  // Check local file existence
  const isLocalFileExists = await stat(fullPath)
    .then((stats) => stats.isFile())
    .catch(() => false);

  if (isLocalFileExists) {
    console.error('Loading repomix config from:', fullPath);
    const loadedConfig = await loadAndValidateConfig(fullPath);
    return mergeRepomixConfigs([defaultConfig, loadedConfig, overrides], rootDir);
  }

  // Try to load global config
  const globalConfigPath = getGlobalConfigPath();
  if (!globalConfigPath) {
    return mergeRepomixConfigs([defaultConfig, overrides], rootDir);
  }
  console.error('Loading global repomix config from:', globalConfigPath);

  const isGlobalFileExists = await stat(globalConfigPath)
    .then((stats) => stats.isFile())
    .catch(() => false);

  if (isGlobalFileExists) {
    const loadedConfig = await loadAndValidateConfig(globalConfigPath);
    return mergeRepomixConfigs([defaultConfig, loadedConfig, overrides], rootDir);
  }

  return mergeRepomixConfigs([defaultConfig, overrides], rootDir);
};

const loadAndValidateConfig = async (filePath: string): Promise<RepomixConfig> => {
  try {
    const fileContent = await readFile(filePath, 'utf-8');
    const config = JSON.parse(fileContent);
    const repomixConfig = config as RepomixConfig;
    return repomixConfig;
  } catch (error) {
    throw new Error(`Error loading config from ${filePath}: ${error}`);
  }
};

/**
 * Merges multiple repomix configurations with sensible defaults
 * Similar to how configurations are merged in the doc command
 *
 * @param configs - Array of repomix configurations to merge
 * @param baseDirectory - Base directory for the cwd property
 * @returns Merged configuration with all defaults applied
 */
function mergeRepomixConfigs(
  configs: Array<Partial<RepomixConfig>>,
  baseDirectory: string
): RepomixConfigMerged {
  // Start with empty config
  let mergedConfig: Partial<RepomixConfig> & { input: { maxFileSize: number } } = {
    input: {
      maxFileSize: defaultConfig.input.maxFileSize,
    },
    output: {
      files: defaultConfig.output.files,
    },
  };

  // Merge all provided configs in order (later configs override earlier ones)
  configs.forEach((config) => {
    mergedConfig = {
      ...mergedConfig,
      ...config,
      input: {
        ...mergedConfig.input,
        ...config.input,
      },
      output: {
        ...mergedConfig.output,
        ...config.output,
      },
      include: config.include ?? mergedConfig.include,
      ignore: {
        ...mergedConfig.ignore,
        ...config.ignore,
      },
      security: {
        ...mergedConfig.security,
        ...config.security,
      },
      tokenCount: {
        ...mergedConfig.tokenCount,
        ...config.tokenCount,
      },
    };
  });

  // Apply defaults and structure similar to doc.ts implementation
  const finalConfig = {
    ...mergedConfig,
    input: {
      ...mergedConfig.input,
    },
    output: {
      ...outputOptions,
      ...mergedConfig.output,
      filePath: mergedConfig.output?.filePath ?? '.repomix-output.txt',
      git: {
        ...outputOptions.git,
        ...mergedConfig.output?.git,
      },
      includeEmptyDirectories: mergedConfig.output?.includeEmptyDirectories ?? false,
    },
    include: mergedConfig.include ?? includePatterns,
    ignore: {
      ...mergedConfig.ignore,
      useGitignore: mergedConfig.ignore?.useGitignore ?? true,
      useDefaultPatterns: mergedConfig.ignore?.useDefaultPatterns ?? true,
      customPatterns: mergedConfig.ignore?.customPatterns ?? ignorePatterns,
    },
    security: {
      ...mergedConfig.security,
      enableSecurityCheck: mergedConfig.security?.enableSecurityCheck ?? true,
    },
    tokenCount: {
      encoding: (mergedConfig.tokenCount?.encoding as 'o200k_base') || 'o200k_base',
    },
    cwd: baseDirectory,
  };

  return finalConfig;
}
