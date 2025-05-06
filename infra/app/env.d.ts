import type { worker } from './alchemy.run';

export type WorkerEnv = typeof worker.Env;

declare module 'cloudflare:workers' {
  namespace Cloudflare {
    export interface Env extends WorkerEnv {}
  }
}
