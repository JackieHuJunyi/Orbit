/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  // Rune is local-first and has no D1/R2 binding yet; these are the Worker's
  // own runtime bindings. Add database/bucket fields here and in
  // `worker/index.ts` when one is actually introduced.
  interface Env {
    ASSETS: Fetcher;
    IMAGES: unknown;
  }
}
