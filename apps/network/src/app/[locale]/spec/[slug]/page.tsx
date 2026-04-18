import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { type Locale, isLocale, locales } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { localePath } from '@/i18n/navigation';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-static';
export const dynamicParams = false;

const SLUGS = ['rfc-0', 'rfc-1', 'rfc-2', 'rfc-3', 'rfc-4', 'rfc-5'] as const;
type Slug = (typeof SLUGS)[number];

export function generateStaticParams(): { locale: Locale; slug: Slug }[] {
  const combos: { locale: Locale; slug: Slug }[] = [];
  for (const locale of locales) {
    for (const slug of SLUGS) {
      combos.push({ locale, slug });
    }
  }
  return combos;
}

const EYEBROWS: Record<Slug, string> = {
  'rfc-0': 'rfc-0 · overview',
  'rfc-1': 'rfc-1 · schema',
  'rfc-2': 'rfc-2 · addressing',
  'rfc-3': 'rfc-3 · auth',
  'rfc-4': 'rfc-4 · aup',
  'rfc-5': 'rfc-5 · persistence',
};

const UPDATED: Record<Slug, string> = {
  'rfc-0': '2026-04-14',
  'rfc-1': '2026-04-15',
  'rfc-2': '2026-04-15',
  'rfc-3': '2026-04-16',
  'rfc-4': '2026-04-16',
  'rfc-5': '2026-04-16',
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
  return dict.rfc.meta(EYEBROWS[slug as Slug] ?? row.slug, row.title);
}

export default async function SpecSlug({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  if (!(SLUGS as readonly string[]).includes(slug)) notFound();
  const typedSlug = slug as Slug;

  const dict = getDictionary(locale);
  const r = dict.rfc;
  const row = dict.spec.rows.find((x) => x.slug === typedSlug);
  const title = row?.title ?? typedSlug;
  const eyebrow = EYEBROWS[typedSlug];
  const updated = UPDATED[typedSlug];
  const pathname = `/${locale}/spec/${typedSlug}`;

  return (
    <>
      <Nav active="spec" locale={locale} dict={dict} pathname={pathname} />
      <main className="mx-auto max-w-[1440px] px-12">
        <div className="grid grid-cols-[280px_minmax(0,92ch)_1fr] gap-16 pt-[200px] pb-24">
          <aside className="sticky top-[100px] self-start flex flex-col gap-3">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">{r.onPage}</span>
            <a
              href="#escopo"
              className="font-label text-sm text-on-surface-variant hover:text-accent"
            >
              {r.tocScope}
            </a>
            <a
              href="#terminologia"
              className="font-label text-sm text-on-surface-variant hover:text-accent"
            >
              {r.tocTerminology}
            </a>
            <a
              href="#exclusoes"
              className="font-label text-sm text-on-surface-variant hover:text-accent"
            >
              {r.tocExclusions}
            </a>
            <a
              href="#cumprimento"
              className="font-label text-sm text-on-surface-variant hover:text-accent"
            >
              {r.tocCompliance}
            </a>
            <a
              href="#referencias"
              className="font-label text-sm text-on-surface-variant hover:text-accent"
            >
              {r.tocReferences}
            </a>
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
              <h1 className="font-headline text-[72px] font-bold leading-[1.1] tracking-tight mt-4">
                {title}
              </h1>
              <p className="font-mono text-sm text-on-surface-variant mt-8">
                {r.versionLine(updated)}
              </p>
            </header>

            <hr className="my-16 h-px border-0 bg-primary-dim/40" />

            <section id="escopo" className="py-12">
              <span className="font-label text-xs text-tertiary tracking-[0.04em]">§1</span>
              <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
                {r.scopeTitle}
              </h2>
              <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
                <p>{r.scopeP1}</p>
                <p>
                  {r.scopeP2A} <span className="font-mono text-primary not-italic">MUST</span>,{' '}
                  <span className="font-mono text-primary not-italic">SHOULD</span>{' '}
                  <span className="font-mono text-primary not-italic">MAY</span> {r.scopeP2B}
                </p>
              </div>
            </section>

            <section id="terminologia" className="py-12">
              <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
              <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
                {r.terminologyTitle}
              </h2>
              <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
                <p>{r.terminologyLead}</p>
                <dl>
                  {r.termsList.map((t) => (
                    <div key={t.term}>
                      <dt className="font-mono text-sm text-primary">{t.term}</dt>
                      <dd className="mt-1 mb-4 text-on-surface-variant">{t.def}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <section id="exclusoes" className="py-12">
              <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
              <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
                {r.exclusionsTitle}
              </h2>
              <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
                <p>{r.exclusionsLead}</p>
                <ol className="list-decimal pl-6 font-label text-sm text-on-surface-variant space-y-2 max-w-[72ch]">
                  {r.exclusionsList.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
            </section>

            <section id="cumprimento" className="py-12">
              <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
              <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
                {r.complianceTitle}
              </h2>
              <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
                <p>{r.complianceP1}</p>
                <p>{r.complianceP2}</p>
              </div>
            </section>

            <section id="referencias" className="py-12">
              <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
              <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
                {r.referencesTitle}
              </h2>
              <div className="mt-6 max-w-[72ch]">
                <ol className="list-decimal pl-6 font-mono text-sm text-on-surface-variant space-y-2">
                  <li>IETF RFC 2119</li>
                  <li>IPFS Whitepaper — Benet (2014)</li>
                  <li>EIP-712 — Typed structured data</li>
                  <li>DMCA §512 (17 U.S.C.)</li>
                  <li>Section 230 (47 U.S.C. §230)</li>
                </ol>
              </div>
            </section>
          </article>

          <div />
        </div>
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
