/// <reference types="@cloudflare/workers-types" />

import { env } from "cloudflare:workers";
// @ts-expect-error - Suppress type errors if the module isn't found during editing/linting
import nitroApp from "../.output/server/index.mjs";

export default {
  async fetch(
    request: Request,
    // @ts-expect-error - Suppress type errors if the module isn't found during editing/linting
    environment: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return nitroApp.fetch(request, environment, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};
