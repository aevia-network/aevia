import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { pageMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMetadata(locale, '/transparency', getDictionary(locale).transparency.meta);
}

export default async function Transparency({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.transparency;
  const pathname = `/${locale}/transparency`;

  return (
    <>
      <Nav locale={locale} dict={dict} pathname={pathname} />
      <main className="mx-auto max-w-[1440px] px-12">
        <section className="mx-auto max-w-[72ch] pt-[200px]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">{t.eyebrow}</span>
          <h1 className="mt-6 font-headline text-[96px] font-bold leading-[1.05] tracking-tight">
            {t.title}
          </h1>
          <p className="mt-8 max-w-[68ch] text-xl text-on-surface-variant leading-[1.7]">
            {t.subtitle}
          </p>
          <p className="mt-8 font-mono text-sm text-on-surface-variant">{t.stamp}</p>
        </section>

        <div className="mx-auto mt-24 max-w-[72ch] border-t border-primary-dim/40" />

        <section className="mx-auto mt-24 max-w-[72ch] space-y-6">
          {t.leadParagraphs.map((paragraph) => (
            <p key={paragraph} className="max-w-[72ch] text-lg leading-[1.7]">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {t.commitmentsTitle}
          </h2>
          <ul className="mt-6 space-y-4 max-w-[72ch] text-base leading-[1.7]">
            {t.commitments.map((item) => (
              <li key={item.tag}>
                <span className="font-mono text-sm text-primary">{item.tag}</span> {item.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{t.cadenceTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.cadenceBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/40 bg-surface-container-low p-8">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
            <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{t.statusTitle}</h2>
            <p className="mt-4 max-w-[72ch] text-base text-on-surface-variant leading-[1.7]">
              {t.statusBody}
            </p>
            <table className="mt-8 w-full border-collapse font-label text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    {t.metricsHeaders.metric}
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    {t.metricsHeaders.count}
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 text-xs tracking-[0.04em] text-tertiary">
                    {t.metricsHeaders.window}
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.metrics.map((row) => (
                  <tr key={row.metric} className="border-b border-primary-dim/20">
                    <td className="py-3 pr-6 text-accent">{row.metric}</td>
                    <td className="py-3 pr-6 font-mono text-primary">{row.count}</td>
                    <td className="py-3 font-mono text-on-surface-variant">{row.window}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{t.archiveTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.archiveBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8">
            <span className="font-label text-xs text-tertiary">§6 · {t.contactTitle}</span>
            <p className="mt-2 max-w-[72ch] text-base text-on-surface-variant leading-[1.7]">
              {t.contactBody1}{' '}
              <a
                href="mailto:contact@aevia.network?subject=transparency correction"
                className="text-primary hover:text-primary-dim"
              >
                contact@aevia.network
              </a>
              {t.contactBody2}
            </p>
          </div>
        </section>

        <div className="pb-[120px]" />
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
