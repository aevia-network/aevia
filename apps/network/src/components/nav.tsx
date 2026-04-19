import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { localePath, switchLocalePath } from '@/i18n/navigation';
import { MeshDot } from '@aevia/ui';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export type NavSlug = 'whitepaper' | 'spec' | 'aup' | 'roadmap' | 'manifesto' | 'faq';

export function Nav({
  active,
  locale,
  dict,
  pathname,
}: {
  active?: NavSlug;
  locale: Locale;
  dict: Dictionary;
  pathname: string;
}) {
  const items: { slug: NavSlug; label: string }[] = [
    { slug: 'whitepaper', label: dict.common.nav.whitepaper },
    { slug: 'spec', label: dict.common.nav.spec },
    { slug: 'aup', label: dict.common.nav.aup },
    { slug: 'roadmap', label: dict.common.nav.roadmap },
    { slug: 'manifesto', label: dict.common.nav.manifesto },
    { slug: 'faq', label: dict.common.nav.faq },
  ];

  const ptPath = switchLocalePath('pt-BR', pathname);
  const enPath = switchLocalePath('en', pathname);

  return (
    <header className="sticky top-0 z-10 border-b border-outline-variant/40 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-6 md:px-12">
        <Link
          href={localePath(locale)}
          className="flex items-center gap-2 font-headline text-base md:text-lg tracking-tight shrink-0"
        >
          <span>aevia.network</span>
          <MeshDot />
        </Link>

        <ul className="hidden lg:flex items-center gap-6 xl:gap-8 font-label text-sm">
          {items.map((item) => {
            const isActive = item.slug === active;
            return (
              <li key={item.slug}>
                <Link
                  href={localePath(locale, `/${item.slug}`)}
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

        <div className="flex items-center gap-3 md:gap-6 font-label text-sm shrink-0">
          <div className="flex items-center gap-2">
            <Link
              href={enPath}
              className={
                locale === 'en'
                  ? 'border-b-2 border-primary pb-1 text-accent'
                  : 'text-on-surface-variant transition-colors hover:text-accent'
              }
            >
              en
            </Link>
            <span className="text-outline-variant">/</span>
            <Link
              href={ptPath}
              className={
                locale === 'pt-BR'
                  ? 'border-b-2 border-primary pb-1 text-accent'
                  : 'text-on-surface-variant transition-colors hover:text-accent'
              }
            >
              pt-br
            </Link>
          </div>

          <a
            href="https://aevia.video"
            className="hidden md:flex items-center gap-1 text-on-surface-variant transition-colors hover:text-accent"
          >
            {dict.common.nav.externalVideo}
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </a>
        </div>
      </nav>

      {/* Mobile/tablet secondary nav row — horizontal scroll for page links */}
      <nav
        className="lg:hidden border-t border-outline-variant/40"
        aria-label="page navigation"
      >
        <ul className="mx-auto flex max-w-[1440px] items-center gap-5 overflow-x-auto px-6 py-3 font-label text-sm">
          {items.map((item) => {
            const isActive = item.slug === active;
            return (
              <li key={item.slug} className="shrink-0">
                <Link
                  href={localePath(locale, `/${item.slug}`)}
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
      </nav>
    </header>
  );
}
