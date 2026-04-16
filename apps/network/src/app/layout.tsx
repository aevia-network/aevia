import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aevia Network — sovereign video protocol',
  description:
    'Protocol, docs, gateways, and Provider Node operations for the Aevia sovereign video network.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-accent antialiased">{children}</body>
    </html>
  );
}
