import type { Metadata } from 'next';
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${inter.variable} ${geist.variable}`}>
      <body className="min-h-screen bg-background font-body text-accent antialiased">
        {children}
      </body>
    </html>
  );
}
