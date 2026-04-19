// Sentry initialization for the browser. Imported by Next.js automatically
// for any client-rendered route. Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// Notes:
//   - DSN comes from `NEXT_PUBLIC_SENTRY_DSN` so deploy can rotate without a
//     code change. The literal fallback is the public ingest DSN — safe to
//     commit (DSNs are public ingestion endpoints, not auth secrets).
//   - Session Replay records 10% of all sessions and 100% of error sessions.
//     Privacy: `maskAllText: false` keeps logs readable for debugging; tighten
//     to `true` once we have any PII surfaces in the player or studio.
//   - `tracesSampleRate` is 100% in dev, 10% in prod to fit Sentry quota.
//   - `onRouterTransitionStart` is the App Router navigation hook — required
//     for client-side route change tracing on Next.js 15 App Router.

import * as Sentry from '@sentry/nextjs';

const DEFAULT_DSN =
  'https://a3a0fca37c342c9fa94996d9eaa7b477@o38363.ingest.us.sentry.io/4511246438563840';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? DEFAULT_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'development',
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  sendDefaultPii: true,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
