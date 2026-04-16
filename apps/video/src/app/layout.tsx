import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aevia — Go live without the gatekeepers',
  description:
    'Low-latency live, automatic VOD, viral clips. Creator-owned. Censorship-resistant by design.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-accent antialiased">{children}</body>
    </html>
  );
}
