import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@aevia/ui', '@aevia/protocol'],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/pt-BR',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
