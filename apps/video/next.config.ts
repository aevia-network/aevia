import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const crossFetchStub = path.resolve(__dirname, 'cross-fetch-stub.js');

/**
 * Next.js 15 config for aevia.video.
 * Deployed via @cloudflare/next-on-pages to Cloudflare Pages.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Transpile workspace packages so imports resolve under Next bundler.
    typedRoutes: false,
  },
  transpilePackages: ['@aevia/ui', '@aevia/auth', '@aevia/protocol'],
  webpack(config, { nextRuntime }) {
    // `cross-fetch/dist/browser-ponyfill.js` imports `whatwg-fetch`, which
    // replaces `globalThis.fetch` with an `XMLHttpRequest`-backed polyfill
    // as an import-time side effect. Cloudflare's edge runtime has `fetch`
    // but no `XMLHttpRequest`, so any subsequent fetch call throws
    // `ReferenceError: XMLHttpRequest is not defined`. The chain is pulled
    // in by `@privy-io/react-auth` → WalletConnect → cross-fetch.
    //
    // Once a page route (which loads the Privy React SDK) has been served
    // by a Worker isolate, the polyfill sits in that isolate's global for
    // the lifetime of the isolate. The next request on the same isolate —
    // including an `/api/lives` POST — picks up the polyfilled fetch.
    // Fresh isolates (e.g. cold-started `curl` calls that never hit a
    // page route) work fine.
    //
    // Aliasing every cross-fetch entry to our native-fetch stub keeps the
    // polyfill out of the bundle entirely.
    config.resolve.alias = {
      ...config.resolve.alias,
      'cross-fetch/polyfill': crossFetchStub,
      'cross-fetch': crossFetchStub,
      'whatwg-fetch': crossFetchStub,
    };

    // next-on-pages 1.13 concatenates every edge function's webpack chunks
    // into a single Worker file. Tiny CJS shims for `node:` built-ins
    // (e.g. `a.exports=require("node:buffer")`) get emitted into multiple
    // chunks, and concatenation then trips the post-processor with
    // "A duplicated identifier has been detected". Workers expose these
    // built-ins natively via `nodejs_compat`, so externalizing them keeps
    // the shim out of the bundle entirely.
    if (nextRuntime === 'edge') {
      const externals = Array.isArray(config.externals)
        ? config.externals
        : config.externals != null
          ? [config.externals]
          : [];
      config.externals = [
        ...externals,
        ({ request }: { request?: string }, cb: (err?: Error | null, result?: string) => void) => {
          if (request?.startsWith('node:')) {
            cb(null, `commonjs ${request}`);
            return;
          }
          cb();
        },
      ];
    }
    return config;
  },
};

// Sentry source-map upload + tunnel route. Auth token comes from
// `.env.sentry-build-plugin` (gitignored) at build time. Tunnel route
// `/monitoring` proxies browser → Sentry to dodge ad-blockers; the
// existing middleware matcher only protects `/dashboard /live/new /wallet`,
// so it doesn't intercept the tunnel.
export default withSentryConfig(nextConfig, {
  org: 'dgl-tech',
  project: 'aevia-video',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Only print upload logs in CI so local dev stays quiet.
  silent: !process.env.CI,
  // Upload a wider set of client source files so prod stack traces resolve
  // to the original module names. Adds a few seconds to build time, worth it.
  widenClientFileUpload: true,
  // Tunnel browser → Sentry through this route to dodge ad-blockers.
  tunnelRoute: '/monitoring',
  webpack: {
    // Project deploys to Cloudflare Pages, not Vercel — automaticVercelMonitors
    // would try to wire Vercel Cron monitors that don't exist. Off.
    automaticVercelMonitors: false,
    treeshake: {
      // Drop Sentry's debug logger statements from the prod bundle.
      removeDebugLogging: true,
    },
  },
});
