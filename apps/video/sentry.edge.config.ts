// Sentry initialization for the Edge runtime (middleware + edge route handlers).
// Loaded by `instrumentation.ts` when NEXT_RUNTIME === 'edge'.
//
// Critical for the Aevia / Cloudflare Pages deployment: every route compiled
// by @cloudflare/next-on-pages effectively runs on the Edge runtime in
// production, so this is the config that catches the majority of server-side
// errors in prod — even routes without an explicit `export const runtime = 'edge'`.

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
