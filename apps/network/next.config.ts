import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@aevia/ui', '@aevia/protocol'],
};

export default nextConfig;
