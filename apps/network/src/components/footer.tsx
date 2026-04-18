import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { localePath } from '@/i18n/navigation';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

const CONTENT_REGISTRY = '0x07ff…5592F0';
const SPEC_VERSION = 'v0.1';
const SOURCE_URL = 'https://github.com/Leeaandrob/aevia';

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const f = dict.common.footer;
  return (
    <footer className="border-t border-outline-variant/40 bg-background">
      <div className="mx-auto grid max-w-[1440px] grid-cols-4 gap-12 px-12 pt-24 pb-12">
        <div className="flex flex-col gap-3 font-label text-sm">
          <span className="text-tertiary">{f.siteHeading}</span>
          <Link
            href={localePath(locale, '/spec')}
            className="text-on-surface-variant hover:text-accent"
          >
            {dict.common.nav.spec}
          </Link>
          <Link
            href={localePath(locale, '/manifesto')}
            className="text-on-surface-variant hover:text-accent"
          >
            {dict.common.nav.manifesto}
          </Link>
          <Link
            href={localePath(locale, '/roadmap')}
            className="text-on-surface-variant hover:text-accent"
          >
            {dict.common.nav.roadmap}
          </Link>
          <Link
            href={localePath(locale, '/providers')}
            className="text-on-surface-variant hover:text-accent"
          >
            {f.providerNodes}
          </Link>
        </div>

        <div className="flex flex-col gap-3 font-label text-sm">
          <span className="text-tertiary">{f.legalHeading}</span>
          <Link
            href={localePath(locale, '/aup')}
            className="text-on-surface-variant hover:text-accent"
          >
            {dict.common.nav.aup}
          </Link>
          <Link
            href={localePath(locale, '/privacy')}
            className="text-on-surface-variant hover:text-accent"
          >
            {f.privacy}
          </Link>
          <Link
            href={localePath(locale, '/terms')}
            className="text-on-surface-variant hover:text-accent"
          >
            {f.terms}
          </Link>
          <a
            href="mailto:contact@aevia.network?subject=dmca takedown"
            className="text-on-surface-variant hover:text-accent"
          >
            {f.dmca}
          </a>
        </div>

        <div className="flex flex-col gap-3 font-label text-sm">
          <span className="text-tertiary">{f.contactHeading}</span>
          <a
            href="mailto:contact@aevia.network"
            className="font-mono text-on-surface-variant hover:text-accent"
          >
            contact@aevia.network
          </a>
          <a
            href={SOURCE_URL}
            className="inline-flex items-center gap-1 text-on-surface-variant hover:text-accent"
          >
            {f.source}
            <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
          </a>
          <span className="font-mono text-xs text-muted leading-[1.6]">{f.agplNote}</span>
        </div>

        <div className="flex flex-col gap-3 font-label text-sm">
          <span className="text-tertiary">{f.protocolHeading}</span>
          <span className="font-mono text-on-surface-variant">
            ContentRegistry {CONTENT_REGISTRY}
          </span>
          <span className="font-mono text-on-surface-variant">{f.network}</span>
          <span className="font-mono text-on-surface-variant">
            {f.protocolVersion(SPEC_VERSION)}
          </span>
          <span className="mt-2 text-on-surface-variant">{f.copyright}</span>
        </div>
      </div>
    </footer>
  );
}
