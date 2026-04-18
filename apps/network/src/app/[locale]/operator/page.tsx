import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { pageMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
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
  return pageMetadata(locale, '/operator', getDictionary(locale).operator.meta);
}

export default async function Operator({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const o = dict.operator;
  const pathname = `/${locale}/operator`;

  return (
    <>
      <Nav locale={locale} dict={dict} pathname={pathname} />
      <main className="mx-auto max-w-[1440px] px-12">
        <section className="mx-auto max-w-[72ch] pt-[200px]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">{o.eyebrow}</span>
          <h1 className="mt-6 font-headline text-[96px] font-bold leading-[1.05] tracking-tight">
            {o.title}
          </h1>
          <p className="mt-8 max-w-[68ch] text-xl text-on-surface-variant leading-[1.7]">
            {o.subtitle}
          </p>
          <p className="mt-8 font-mono text-sm text-on-surface-variant">{o.stamp}</p>
        </section>

        <div className="mx-auto mt-24 max-w-[72ch] border-t border-primary-dim/40" />

        <section className="mx-auto mt-24 max-w-[72ch] space-y-6">
          {o.leadParagraphs.map((paragraph) => (
            <p key={paragraph} className="max-w-[72ch] text-lg leading-[1.7]">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§1</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{o.legalTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{o.legalBody}</p>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7] text-on-surface-variant">
            {o.legalFuture}
          </p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{o.operatesTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{o.operatesLead}</p>
          <ul className="mt-6 space-y-4 max-w-[72ch] text-base leading-[1.7]">
            {o.operatesItems.map((item) => (
              <li key={item.tag}>
                <span className="font-mono text-sm text-primary">{item.tag}</span> — {item.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/40 bg-surface-container-low p-8">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
            <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
              {o.notControlsTitle}
            </h2>
            <p className="mt-4 max-w-[72ch] text-base text-on-surface-variant leading-[1.7]">
              {o.notControlsLead}
            </p>
            <ul className="mt-6 space-y-4 max-w-[72ch] text-base leading-[1.7]">
              {o.notControlsItems.map((item) => (
                <li key={item.tag}>
                  <span className="font-mono text-sm text-primary">{item.tag}</span> — {item.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{o.revenueTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{o.revenueLead}</p>
          <ul className="mt-6 space-y-3 max-w-[72ch] text-base leading-[1.7]">
            {o.revenueItems.map((item) => (
              <li key={item.tag}>
                <span className="font-mono text-sm text-primary">{item.tag}</span> — {item.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {o.brightLinesTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{o.brightLinesLead}</p>
          <ul className="mt-6 space-y-3 max-w-[72ch] text-base leading-[1.7]">
            {o.brightLinesItems.map((item) => (
              <li key={item.tag}>
                <span className="font-mono text-sm text-primary">{item.tag}</span> — {item.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-24 max-w-[92ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {o.addressesTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{o.addressesLead}</p>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full border-collapse font-label text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    {o.addressesHeaders.label}
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    {o.addressesHeaders.address}
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    {o.addressesHeaders.network}
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 text-xs tracking-[0.04em] text-tertiary">
                    {o.addressesHeaders.threshold}
                  </th>
                </tr>
              </thead>
              <tbody>
                {o.addressesTable.map((row) => (
                  <tr key={row.label} className="border-b border-primary-dim/20">
                    <td className="py-3 pr-6 text-accent">{row.label}</td>
                    <td className="py-3 pr-6 font-mono text-xs text-on-surface-variant">
                      {row.address}
                    </td>
                    <td className="py-3 pr-6 font-mono text-xs text-on-surface-variant">
                      {row.network}
                    </td>
                    <td className="py-3 font-mono text-xs text-on-surface-variant">
                      {row.threshold}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{o.changesTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{o.changesBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8">
            <span className="font-label text-xs text-tertiary">§8 · {o.contactTitle}</span>
            <p className="mt-2 max-w-[72ch] text-base text-on-surface-variant leading-[1.7]">
              {o.contactBody1}{' '}
              <a
                href="mailto:contact@aevia.network?subject=operator inquiry"
                className="text-primary hover:text-primary-dim"
              >
                contact@aevia.network
              </a>
              {o.contactBody2}
            </p>
          </div>
        </section>

        <div className="pb-[120px]" />
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
