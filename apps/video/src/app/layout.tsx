import { Providers } from '@/components/providers';
import { RegisterServiceWorker } from '@/components/register-sw';
import { UploadBanner } from '@/components/upload-banner';
import { clientEnv } from '@/lib/env';
import type { Metadata, Viewport } from 'next';
import { Geist, Inter, Sora } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

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

export const metadata: Metadata = {
  title: 'aevia — vídeo sem intermediários',
  description:
    'live de baixa latência, vod automático, clips virais. seu conteúdo, sua audiência, seu protocolo.',
  metadataBase: new URL(clientEnv.appUrl),
  applicationName: 'aevia',
  appleWebApp: {
    capable: true,
    title: 'aevia',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0F1115',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${inter.variable} ${geist.variable}`}>
      <body className="min-h-screen bg-background font-body text-accent antialiased">
        <Providers>
          <UploadBanner />
          {children}
        </Providers>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
