import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { isLocale } from '@/i18n/config';
import { type RFCSlug, getRFCContent } from '@/i18n/content/rfcs';
import { getDictionary } from '@/i18n/get-dictionary';
import { pageMetadata } from '@/i18n/metadata';
import { localePath } from '@/i18n/navigation';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const runtime = 'edge';
export const dynamic = 'force-static';

const SLUGS = [
  'rfc-0',
  'rfc-1',
  'rfc-2',
  'rfc-3',
  'rfc-4',
  'rfc-5',
  'rfc-6',
  'rfc-7',
  'rfc-8',
] as const;

const EYEBROWS: Record<RFCSlug, string> = {
  'rfc-0': 'rfc-0 · overview',
  'rfc-1': 'rfc-1 · schema',
  'rfc-2': 'rfc-2 · addressing',
  'rfc-3': 'rfc-3 · auth',
  'rfc-4': 'rfc-4 · aup',
  'rfc-5': 'rfc-5 · persistence',
  'rfc-6': 'rfc-6 · risk score',
  'rfc-7': 'rfc-7 · moderation',
  'rfc-8': 'rfc-8 · economic architecture',
};

const UPDATED: Record<RFCSlug, string> = {
  'rfc-0': '2026-04-14',
  'rfc-1': '2026-04-15',
  'rfc-2': '2026-04-15',
  'rfc-3': '2026-04-16',
  'rfc-4': '2026-04-16',
  'rfc-5': '2026-04-16',
  'rfc-6': '2026-04-18',
  'rfc-7': '2026-04-18',
  'rfc-8': '2026-04-18',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const row = dict.spec.rows.find((r) => r.slug === slug);
  if (!row) return { title: dict.spec.meta.title };
  const base = dict.rfc.meta(EYEBROWS[slug as RFCSlug] ?? row.slug, row.title);
  return pageMetadata(locale, `/spec/${slug}`, base);
}

export default async function SpecSlug({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  if (!(SLUGS as readonly string[]).includes(slug)) notFound();
  const typedSlug = slug as RFCSlug;

  const dict = getDictionary(locale);
  const r = dict.rfc;
  const row = dict.spec.rows.find((x) => x.slug === typedSlug);
  const title = row?.title ?? typedSlug;
  const eyebrow = EYEBROWS[typedSlug];
  const updated = UPDATED[typedSlug];
  const pathname = `/${locale}/spec/${typedSlug}`;

  const content = getRFCContent(typedSlug, locale);

  return (
    <>
      <Nav active="spec" locale={locale} dict={dict} pathname={pathname} />
      <main className="mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,92ch)_1fr] gap-8 lg:gap-16 pt-[120px] md:pt-[200px] pb-24">
          <aside
            data-print-hide="true"
            className="hidden lg:sticky lg:top-[100px] lg:self-start lg:flex lg:flex-col lg:gap-3"
          >
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">{r.onPage}</span>
            {content.toc.map((entry) => (
              <a
                key={entry.id}
                href={`#${entry.id}`}
                className="font-label text-sm text-on-surface-variant hover:text-accent"
              >
                {entry.label}
              </a>
            ))}
            <div className="h-12" />
            <a
              href={localePath(locale, '/spec')}
              className="font-label text-sm text-primary hover:text-primary-dim"
            >
              {r.backToIndex}
            </a>
          </aside>

          <article>
            <header>
              <span className="font-label text-xs text-tertiary tracking-[0.04em]">{eyebrow}</span>
              <h1 className="font-headline text-4xl md:text-5xl lg:text-[72px] font-bold leading-[1.1] tracking-tight mt-4">
                {title}
              </h1>
              <p className="font-mono text-sm text-on-surface-variant mt-8">
                {r.versionLine(updated)}
              </p>
            </header>

            <hr className="my-16 h-px border-0 bg-primary-dim/40" />

            <content.Body />
          </article>

          <div />
        </div>
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
