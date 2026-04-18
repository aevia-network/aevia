import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { pageMetadata } from '@/i18n/metadata';
import { localePath } from '@/i18n/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMetadata(locale, '/privacy', getDictionary(locale).privacy.meta);
}

export default async function Privacy({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const p = dict.privacy;
  const pathname = `/${locale}/privacy`;

  return (
    <>
      <Nav locale={locale} dict={dict} pathname={pathname} />
      <main className="mx-auto max-w-[1440px] px-12">
        <section className="mx-auto max-w-[72ch] pt-[200px]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">{p.eyebrow}</span>
          <h1 className="mt-6 font-headline text-[96px] font-bold leading-[1.05] tracking-tight">
            {p.title}
          </h1>
          <p className="mt-8 max-w-[68ch] text-xl text-on-surface-variant leading-[1.7]">
            {p.subtitle}
          </p>
          <p className="mt-8 font-mono text-sm text-on-surface-variant">{p.stamp}</p>
        </section>

        <div className="mx-auto mt-24 max-w-[72ch] border-t border-primary-dim/40" />

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§1</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {p.controllerTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            {p.controllerBodyA}{' '}
            <a
              href="mailto:contact@aevia.network?subject=privacy request"
              className="text-primary hover:text-primary-dim underline"
            >
              contact@aevia.network
            </a>
            {p.controllerBodyB}
          </p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{p.collectTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{p.collectLead}</p>
          <ul className="mt-6 space-y-4 max-w-[72ch] text-base leading-[1.7]">
            {p.collectItems.map((item) => (
              <li key={item.tag}>
                <span className="font-mono text-sm text-primary">{item.tag}</span> {item.text}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-[72ch] text-base leading-[1.7] text-on-surface-variant">
            {p.collectFooter}
          </p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">
            {p.legalBasisEyebrow}
          </span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {p.legalBasisTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{p.legalBasisLead}</p>
          <ul className="mt-6 space-y-3 max-w-[72ch] text-base leading-[1.7]">
            {p.legalBasisItems.map((item) => (
              <li key={item.tag}>
                <span className="font-mono text-sm text-primary">{item.tag}</span> {item.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{p.rightsTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{p.rightsLead}</p>
          <ul className="mt-6 space-y-3 max-w-[72ch] text-base leading-[1.7]">
            {p.rightsItems.map((item) => (
              <li key={item.tag}>
                <span className="font-mono text-sm text-primary">{item.tag}</span> {item.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {p.retentionTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{p.retentionBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{p.transferTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{p.transferBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {p.processorsTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{p.processorsLead}</p>
          <ul className="mt-6 space-y-3 max-w-[72ch] text-base leading-[1.7]">
            {p.processorsItems.map((item) => (
              <li key={item.tag}>
                <span className="font-mono text-sm text-primary">{item.tag}</span> {item.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§8</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{p.cookiesTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{p.cookiesBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§9</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{p.minorsTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            {p.minorsBodyA}{' '}
            <Link
              href={localePath(locale, '/aup')}
              className="text-primary hover:text-primary-dim underline"
            >
              {p.minorsBodyLink}
            </Link>
            {p.minorsBodyB}
          </p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§10</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{p.changesTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            {p.changesBodyA}{' '}
            <Link
              href={localePath(locale, '/roadmap')}
              className="text-primary hover:text-primary-dim underline"
            >
              {p.changesBodyLink}
            </Link>
            {p.changesBodyB}
          </p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8">
            <span className="font-label text-xs text-tertiary">{p.contactEyebrow}</span>
            <p className="mt-2 max-w-[72ch] text-base text-on-surface-variant leading-[1.7]">
              {p.contactBody1}{' '}
              <a
                href="mailto:contact@aevia.network?subject=privacy request"
                className="text-primary hover:text-primary-dim"
              >
                contact@aevia.network
              </a>
              {p.contactBody2}
            </p>
          </div>
        </section>

        <div className="pb-[120px]" />
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
