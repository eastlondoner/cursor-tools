/// <reference types="@cloudflare/workers-types" />
import type { WorkerEnv } from './env.d';
// @ts-ignore - Suppress type errors if the module isn't found during editing/linting
import nitroApp from '../.output/server/index.mjs';

export default {
  async fetch(request: Request, environment: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return nitroApp.fetch(request, environment, ctx);
    }

    return environment.ASSETS.fetch(request);
  },
};
