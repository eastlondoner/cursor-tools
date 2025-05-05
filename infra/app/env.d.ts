/// <reference types="./env.d.ts" />

import type { website } from "../alchemy.run";

export type CloudFlareEnv = typeof website.Env;

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudFlareEnv {}
  }
}
