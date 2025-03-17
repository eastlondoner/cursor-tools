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

export const includePatterns = ['**/*', '.cursorrules', '.cursor/rules/*'];

export const outputOptions = {
  compress: false,
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
