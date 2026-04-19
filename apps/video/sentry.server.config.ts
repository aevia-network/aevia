// Sentry initialization for the Node.js server runtime.
// Loaded by `instrumentation.ts` when NEXT_RUNTIME === 'nodejs'.
// Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// Notes for the Aevia / Cloudflare Pages deployment:
//   - DSN comes from `SENTRY_DSN` (server) so the same project can rotate
//     keys without a code change. The literal fallback is the public
//     ingest DSN — safe to commit (DSNs are not secrets).
//   - `includeLocalVariables` is intentionally NOT enabled: it requires
//     the V8 inspector, which is not present in Cloudflare Workers (where
//     most of our "server" routes actually run via @cloudflare/next-on-pages).
//   - `tracesSampleRate` is 100% in dev, 10% in prod to keep within the
//     Sentry quota. Bump per-route via `tracesSampler` when needed.

import * as Sentry from '@sentry/nextjs';

const DEFAULT_DSN =
  'https://a3a0fca37c342c9fa94996d9eaa7b477@o38363.ingest.us.sentry.io/4511246438563840';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? DEFAULT_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  enableLogs: true,
  sendDefaultPii: true,
});
