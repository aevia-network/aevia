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
    'Protocol home for Aevia. Persistence does not imply distribution. Whitepaper, RFC specification, AUP, roadmap, manifesto.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://aevia.network'),
  applicationName: 'aevia.network',
  icons: {
    icon: '/icon.svg',
    shortcut: '/favicon.svg',
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

  return (
    <html
      lang={locale}
      className={`${sora.variable} ${inter.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-background font-body text-accent antialiased">
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
