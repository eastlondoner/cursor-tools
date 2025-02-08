export const ignorePatterns = [
  '**/*.pbxproj',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/compile/**',
  '**/.*/**',
  '**/*.spec.*',
  '**/*.pyc',
  '**/*.env',
  '**/*.env.*',
  '**/*.lock',
  '**/*.lockb',
  '**/package-lock.*',
  '**/pnpm-lock.*',
  '**/*.tsbuildinfo',
];

export const includePatterns = ['**/*', '!.cursorrules', '!.cursor/rules/cursor-tools.mdc'];

export const outputOptions = {
  style: 'xml',
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
