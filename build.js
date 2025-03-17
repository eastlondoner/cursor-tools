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

const buildOptions = {
  entryPoints: ['./src/index.ts'],
  bundle: true,
  minify: true,
  treeShaking: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: './dist/index.mjs',
  banner: {
    js: `#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`
  },
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

if (watch) {
  const context = await esbuild.context(buildOptions);
  // eslint-disable-next-line no-undef
  console.log('Watching for changes...');
  await context.watch();
} else {
  await esbuild.build(buildOptions);
  
  // Make the output file executable on Unix-like systems
  if (platform() !== 'win32') {
    await chmod('./dist/index.mjs', 0o755);
  }
   
  // eslint-disable-next-line no-undef
  console.log('Build complete');
}
