import * as Sentry from '@sentry/nextjs';

// Cloudflare Pages deploy requires every non-static route declare the
// edge runtime explicitly. This synthetic sentry test route is no
// exception — even though it's dev-only.
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = 'SentryExampleAPIError';
  }
}

// A faulty API route to test Sentry's error monitoring
export function GET() {
  Sentry.logger.info('Sentry example API called');
  throw new SentryExampleAPIError(
    'This error is raised on the backend called by the example page.',
  );
}
