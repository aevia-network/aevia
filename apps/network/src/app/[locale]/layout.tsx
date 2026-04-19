import { StructuredData } from '@/components/structured-data';
import { isLocale } from '@/i18n/config';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Inter, Sora } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import '../globals.css';

const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-headline',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-body',
  display: 'swap',
});

const geist = Geist({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-label',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'aevia.network — sovereign video protocol',
    template: '%s · aevia.network',
  },
  description:
    'Aevia — sovereign video protocol. Persistence does not imply distribution. Whitepaper, RFC specification, AUP, roadmap, manifesto, FAQ.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://aevia.network'),
  applicationName: 'aevia.network',
  authors: [{ name: 'Leandro Barbosa', url: 'https://github.com/Leeaandrob' }],
  creator: 'Aevia LLC',
  publisher: 'Aevia LLC',
  keywords: [
    'sovereign video',
    'video protocol',
    'libp2p',
    'decentralized streaming',
    'base l2',
    'usdc',
    'proof of relay',
    'persistence pool',
    'content addressing',
    'cidv1',
    'whip',
    'whep',
    'll-hls',
    'cloudflare alternative',
    'youtube alternative',
    'creator economy',
    'censorship resistance',
  ],
  icons: {
    icon: '/icon.svg',
    shortcut: '/favicon.svg',
    apple: '/apple-icon',
  },
  openGraph: {
    type: 'website',
    siteName: 'aevia.network',
    title: 'aevia.network — sovereign video protocol',
    description:
      'Sovereign video protocol. Persistence does not imply distribution. Open spec, non-custodial USDC settlement on Base L2, libp2p provider-node mesh.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'aevia.network — sovereign video protocol',
    description:
      'Sovereign video protocol. Persistence does not imply distribution.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F1115',
  colorScheme: 'dark',
};

export const runtime = 'edge';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const cfToken = process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aevia.network';

  return (
    <html
      lang={locale}
      className={`${sora.variable} ${inter.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-background font-body text-accent antialiased">
        <StructuredData baseUrl={baseUrl} />
        {children}
        {cfToken ? (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${cfToken}"}`}
          />
        ) : null}
      </body>
    </html>
  );
}
