import alchemy from 'alchemy';
import { Exec } from 'alchemy/os';
import { Assets, Worker, Pipeline, R2Bucket } from 'alchemy/cloudflare';
import fs from 'fs/promises';
import path from 'path';

const STATIC_ASSETS_PATH = './.output/public/';
const R2_BUCKET_NAME = 'vibe-tools-telemetry';
const PIPELINE_NAME = 'vibe-tools-telemetry';
const WORKER_NAME = 'vibe-tools-infra';
const TELEMETRY_FILE_PATH = path.resolve(__dirname, '../src/telemetry.ts'); // Use absolute path

const app = await alchemy('vibe-tools-infra', {
  stage: 'dev',
  phase: process.argv.includes('--destroy') ? 'destroy' : 'up',
  quiet: process.argv.includes('--verbose') ? false : true,
  password: process.env.ALCHEMY_PASS,
});

await Exec('build', {
  command: 'bun run build',
});

const staticAssets = await Assets('static-assets', {
  path: STATIC_ASSETS_PATH,
});

const bucket = await R2Bucket('bucket', {
  name: R2_BUCKET_NAME,
});

await new Promise((resolve) => setTimeout(resolve, 10000));
const pipeline = await Pipeline('pipeline', {
  name: PIPELINE_NAME,
  source: [{ type: 'binding', format: 'json' }],
  destination: {
    type: 'r2',
    format: 'json',
    path: {
      bucket: bucket.name,
    },
    credentials: {
      accessKeyId: alchemy.secret(process.env.R2_ACCESS_KEY_ID),
      secretAccessKey: alchemy.secret(process.env.R2_SECRET_ACCESS_KEY),
    },
    batch: {
      maxMb: 10,
      maxSeconds: 5,
      maxRows: 100,
    },
  },
});

export const website = await Worker('worker', {
  name: WORKER_NAME,
  entrypoint: './app/index.ts',
  url: true,
  bindings: {
    ASSETS: staticAssets,
    R2_BUCKET: bucket,
    PIPELINE: pipeline,
  },
});

console.log({
  url: website.url,
});

if (website.url) {
  const newEndpoint = `${website.url}/api/pipeline`;
  try {
    // Read the telemetry file
    let telemetryContent = await fs.readFile(TELEMETRY_FILE_PATH, 'utf-8');

    // Replace the endpoint line
    telemetryContent = telemetryContent.replace(
      /^const TELEMETRY_ENDPOINT = .*;/m, // Match the whole line
      `const TELEMETRY_ENDPOINT = '${newEndpoint}';`
    );

    // Write the updated content back
    await fs.writeFile(TELEMETRY_FILE_PATH, telemetryContent, 'utf-8');
    console.log(`Successfully updated TELEMETRY_ENDPOINT in ${TELEMETRY_FILE_PATH}`);
  } catch (err) {
    console.error('Error updating telemetry file:', err);
  }
} else {
  console.warn('Worker URL not available, skipping update of src/telemetry.ts');
}

await app.finalize();
