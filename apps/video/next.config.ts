import type { NextConfig } from 'next';

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
};

export default nextConfig;
