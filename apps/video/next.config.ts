import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  webpack(config) {
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
    return config;
  },
};

export default nextConfig;
