import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { pageMetadata } from '@/i18n/metadata';
import { localePath } from '@/i18n/navigation';
import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const runtime = 'edge';
export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMetadata(locale, '/spec', getDictionary(locale).spec.meta);
}

type StatusKey = 'published' | 'draft' | 'planned';

function StatusPill({ status, labels }: { status: StatusKey; labels: Record<StatusKey, string> }) {
  if (status === 'published') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-tertiary/10 px-2.5 py-0.5 text-xs text-tertiary">
        {labels.published}
      </span>
    );
  }
  if (status === 'draft') {
    return (
      <span className="inline-flex items-center rounded-full border border-secondary/50 px-2.5 py-0.5 text-xs text-secondary">
        {labels.draft}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-outline-variant/50 px-2.5 py-0.5 text-xs italic text-on-surface-variant">
      {labels.planned}
    </span>
  );
}

export default async function SpecIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const s = dict.spec;
  const pathname = `/${locale}/spec`;

  return (
    <>
      <Nav active="spec" locale={locale} dict={dict} pathname={pathname} />
      <main className="mx-auto max-w-[1440px] px-12">
        <section className="mx-auto max-w-[72ch] pt-[200px]">
          <p className="font-label text-xs tracking-[0.04em] text-tertiary">{s.eyebrow}</p>
          <h1 className="mt-6 font-headline text-[96px] font-bold leading-[1.05] tracking-tight text-accent">
            {s.title}
          </h1>
          <p className="mt-8 max-w-[68ch] text-xl leading-[1.7] text-on-surface-variant">
            {s.subtitle}
          </p>
          <p className="mt-8 font-mono text-sm text-on-surface-variant">{s.stamp}</p>
        </section>

        <div className="mx-auto mt-24 max-w-[92ch] border-t border-primary-dim/40" />

        <section className="mx-auto mt-24 flex max-w-[72ch] flex-col gap-6">
          <p className="text-lg leading-[1.7] text-on-surface-variant">{s.coverA}</p>
          <p className="text-lg leading-[1.7] text-on-surface-variant">{s.coverB}</p>
        </section>

        <section className="mx-auto mt-20 max-w-[92ch]">
          <table className="w-full border-collapse font-label text-sm">
            <thead>
              <tr className="text-left">
                <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                  {s.tableHeaders.slug}
                </th>
                <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                  {s.tableHeaders.title}
                </th>
                <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                  {s.tableHeaders.status}
                </th>
                <th className="border-b border-primary-dim/40 pb-3 text-xs tracking-[0.04em] text-tertiary">
                  {s.tableHeaders.updated}
                </th>
              </tr>
            </thead>
            <tbody>
              {s.rows.map((row) => (
                <tr key={row.slug} className="border-b border-primary-dim/20">
                  <td className="py-3 pr-6 font-mono text-accent">{row.slug}</td>
                  <td className="py-3 pr-6 text-accent">{row.title}</td>
                  <td className="py-3 pr-6">
                    <StatusPill status={row.status as StatusKey} labels={s.status} />
                  </td>
                  <td className="py-3 text-on-surface-variant">{row.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mx-auto mt-24 max-w-[92ch]">
          <p className="mb-6 font-label text-xs tracking-[0.04em] text-tertiary">
            {s.documentsLabel}
          </p>
          <div className="grid grid-cols-2 gap-12">
            {s.cards.map((card) => (
              <Link
                key={card.slug}
                href={localePath(locale, `/spec/${card.slug}`)}
                className="group flex min-h-[240px] flex-col gap-5 rounded-lg border border-primary-dim/30 bg-surface-container-low p-8 transition-colors hover:bg-surface-low/60"
              >
                <div className="flex items-start justify-between">
                  <span className="font-label text-xs tracking-[0.04em] text-tertiary">
                    {card.slug}
                  </span>
                  <StatusPill status="published" labels={s.status} />
                </div>
                <h2 className="font-headline text-2xl font-bold leading-tight text-accent">
                  {card.title}
                </h2>
                <p className="max-w-[56ch] flex-grow text-base leading-[1.6] text-on-surface-variant">
                  {card.abstract}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-on-surface-variant">
                    {card.sectionsLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 font-label text-sm text-primary">
                    {s.readDocument}
                    <ArrowRight
                      size={14}
                      strokeWidth={1.5}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-[92ch] border-t border-primary-dim/30 pt-12 pb-24">
          <p className="font-label text-xs tracking-[0.04em] text-tertiary">{s.referencesLabel}</p>
          <ol className="mt-6 list-decimal space-y-2 pl-6 font-mono text-sm text-on-surface-variant">
            <li>IETF RFC 2119 — Key words for RFCs</li>
            <li>IPFS Whitepaper — Benet (2014)</li>
            <li>Ethereum EIP-712 — Typed structured data hashing</li>
            <li>DMCA §512 — Safe harbor procedure</li>
            <li>Section 230 (47 U.S.C. §230) — Intermediary immunity</li>
          </ol>
        </section>
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
