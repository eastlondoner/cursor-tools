import * as esbuild from 'esbuild';
import { argv } from 'node:process';
import { chmod } from 'node:fs/promises';
import { platform } from 'node:os';

const watch = argv.includes('--watch');

const nodeBuiltinsPlugin = {
  name: 'node-builtins',
  setup(build) {
    // Handle punycode redirects
    build.onResolve({ filter: /^(node:)?punycode$/ }, () => ({
      path: 'punycode/',
      external: true
    }));

    // Handle other node builtins
    build.onResolve({ filter: /^(util|http)$/ }, args => ({
      path: args.path,
      namespace: 'node-builtin'
    }));

    build.onLoad({ filter: /.*/, namespace: 'node-builtin' }, args => ({
      contents: `export * from 'node:${args.path}'; export { default } from 'node:${args.path}';`,
      loader: 'js'
    }));
  }
};

const commonBuildOptions = {
  bundle: true,
  minify: true,
  treeShaking: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  resolveExtensions: ['.ts', '.js'],
  external: [
    // Node built-ins
    'node:*',
    'stream',
    'events',
    'url',
    'path',
    'fs',
    'util',
    'http',
    'https',
    'os',
    'crypto',
    'process',
    'punycode',
    // External dependencies
    'dotenv',
    'google-auth-library',
    'repomix',
    'eventsource-client',
    // Playwright and its dependencies (peer dependency)
    'playwright',
    'playwright-core',
    'chromium-bidi',
    'chromium-bidi/*',
  ],
  keepNames: true,
  mainFields: ['module', 'main'],
  define: {},
  plugins: [nodeBuiltinsPlugin]
};

const mainBuildOptions = {
  ...commonBuildOptions,
  entryPoints: ['./src/index.ts'],
  outfile: './dist/index.mjs',
  banner: {
    js: `#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`
  },
};

const llmsBuildOptions = {
  ...commonBuildOptions,
  entryPoints: ['./src/llms/index.ts'],
  outfile: './dist/llms/index.mjs',
  banner: {
    js: `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`
  },
};

if (watch) {
  const mainContext = await esbuild.context(mainBuildOptions);
  const llmsContext = await esbuild.context(llmsBuildOptions);
  // eslint-disable-next-line no-undef
  console.log('Watching for changes...');
  await mainContext.watch();
  await llmsContext.watch();
} else {
  await esbuild.build(mainBuildOptions);
  await esbuild.build(llmsBuildOptions);
  
  // Make the output file executable on Unix-like systems
  if (platform() !== 'win32') {
    await chmod('./dist/index.mjs', 0o755);
    // No need to chmod llms/index.mjs as it's likely a library, not an executable
  }
   
  // eslint-disable-next-line no-undef
  console.log('Build complete');
}
