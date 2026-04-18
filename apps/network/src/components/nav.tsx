import { MeshDot } from '@aevia/ui';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

type NavSlug = 'whitepaper' | 'spec' | 'aup' | 'roadmap' | 'manifesto';

const LABELS: { href: string; label: string; slug: NavSlug }[] = [
  { href: '/whitepaper', label: 'whitepaper', slug: 'whitepaper' },
  { href: '/spec', label: 'spec', slug: 'spec' },
  { href: '/aup', label: 'aup', slug: 'aup' },
  { href: '/roadmap', label: 'roadmap', slug: 'roadmap' },
  { href: '/manifesto', label: 'manifesto', slug: 'manifesto' },
];

export function Nav({ active, locale = 'en' }: { active?: NavSlug; locale?: 'en' | 'pt-BR' }) {
  return (
    <header className="sticky top-0 z-10 border-b border-outline-variant/40 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-12">
        <Link href="/" className="flex items-center gap-2 font-headline text-lg tracking-tight">
          <span>aevia.network</span>
          <MeshDot />
        </Link>

        <ul className="flex items-center gap-8 font-label text-sm">
          {LABELS.map((item) => {
            const isActive = item.slug === active;
            return (
              <li key={item.slug}>
                <Link
                  href={item.href}
                  className={
                    isActive
                      ? 'border-b-2 border-primary pb-1 text-accent'
                      : 'text-on-surface-variant transition-colors hover:text-accent'
                  }
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-6 font-label text-sm">
          <div className="flex items-center gap-2">
            <span
              className={
                locale === 'en'
                  ? 'border-b-2 border-primary pb-1 text-accent'
                  : 'text-on-surface-variant'
              }
            >
              en
            </span>
            <span className="text-outline-variant">/</span>
            <span
              className={
                locale === 'pt-BR'
                  ? 'border-b-2 border-primary pb-1 text-accent'
                  : 'text-on-surface-variant'
              }
            >
              pt-br
            </span>
          </div>

          <a
            href="https://aevia.video"
            className="flex items-center gap-1 text-on-surface-variant transition-colors hover:text-accent"
          >
            aevia.video
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </a>
        </div>
      </nav>
    </header>
  );
}
