import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { pageMetadata } from '@/i18n/metadata';
import { localePath } from '@/i18n/navigation';
import { ArrowUpRight } from 'lucide-react';
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
  return pageMetadata(locale, '/aup', getDictionary(locale).aup.meta);
}

export default async function AUP({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const a = dict.aup;
  const pathname = `/${locale}/aup`;

  return (
    <>
      <Nav active="aup" locale={locale} dict={dict} pathname={pathname} />
      <main className="mx-auto max-w-[1440px] px-6 md:px-12">
        <section className="mx-auto max-w-[72ch] pt-[120px] md:pt-[200px]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">{a.eyebrow}</span>
          <h1 className="mt-6 font-headline text-5xl md:text-[96px] font-bold leading-[1.05] tracking-tight">
            {a.title}
          </h1>
          <p className="mt-8 max-w-[68ch] text-xl text-on-surface-variant leading-[1.7]">
            {a.subtitle}
          </p>
          <p className="mt-8 font-mono text-sm text-on-surface-variant">{a.stamp}</p>
        </section>

        <div className="mx-auto mt-24 max-w-[72ch] border-t border-primary-dim/40" />

        <section className="mx-auto mt-24 max-w-[72ch] space-y-6">
          {a.leadParagraphs.map((paragraph) => (
            <p key={paragraph} className="max-w-[72ch] text-lg leading-[1.7]">
              {paragraph}
            </p>
          ))}
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-5xl font-bold leading-tight">
            {a.exclusionsTitle}
          </h2>
          <p className="mt-6 max-w-[72ch] text-lg leading-[1.7] text-on-surface-variant">
            {a.exclusionsLead}
          </p>
          <ol className="mt-10 space-y-3">
            {a.exclusions.map((item) => (
              <li key={item.key} className="max-w-[72ch] text-base text-accent leading-[1.6]">
                <span className="mr-3 font-mono text-primary">{item.key}</span>
                {item.text}
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{a.ageTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base text-on-surface-variant leading-[1.7]">
            {a.ageBody}
          </p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/40 bg-surface-container-low p-10">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">
              {a.dmcaEyebrow}
            </span>
            <h3 className="mt-2 font-headline text-3xl font-bold leading-tight">{a.dmcaTitle}</h3>
            <p className="mt-6 text-base leading-[1.7]">{a.dmcaBody1}</p>
            <p className="mt-4 text-base leading-[1.7]">{a.dmcaBody2}</p>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
              <div>
                <span className="font-label text-xs text-tertiary">{a.dmcaAgentLabel}</span>
                <p className="mt-2 font-mono text-sm text-accent">
                  aevia llc
                  <br />
                  contact@aevia.network
                  <br />
                  delaware, usa
                </p>
              </div>
              <div>
                <span className="font-label text-xs text-tertiary">{a.dmcaRegistryLabel}</span>
                <a
                  href="https://www.copyright.gov/dmca-directory/"
                  className="mt-2 inline-flex items-center gap-1 font-mono text-sm text-primary hover:text-primary-dim"
                >
                  u.s. copyright office <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">{a.dsaEyebrow}</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{a.dsaTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{a.dsaBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">
            {a.s230Eyebrow}
          </span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{a.s230Title}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{a.s230Body1}</p>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{a.s230Body2}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="border-l-2 border-danger/60 bg-surface-container-low py-4 pl-6">
            <span className="font-label text-xs tracking-[0.04em] text-danger">
              {a.ncmecEyebrow}
            </span>
            <p className="mt-2 max-w-[72ch] text-base text-accent leading-[1.6]">{a.ncmecBody}</p>
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">
            {a.sanctionsEyebrow}
          </span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {a.sanctionsTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{a.sanctionsBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§9</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{a.privacyTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            {a.privacyBody1}{' '}
            <Link
              href={localePath(locale, '/privacy')}
              className="text-primary hover:text-primary-dim underline"
            >
              {a.privacyBodyLink}
            </Link>{' '}
            {a.privacyBody2}
          </p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§10</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {a.arbitrationTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{a.arbitrationBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§11</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {a.liabilityTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{a.liabilityBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§12</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {a.indemnityTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{a.indemnityBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8">
            <span className="font-label text-xs text-tertiary">{a.jurisdictionEyebrow}</span>
            <p className="mt-2 max-w-[72ch] text-base text-on-surface-variant leading-[1.7]">
              {a.jurisdictionBody}
            </p>
          </div>
        </section>

        <div className="pb-[120px]" />
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
