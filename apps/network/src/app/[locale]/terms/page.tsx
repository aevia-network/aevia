import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
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
  return getDictionary(locale).terms.meta;
}

export default async function Terms({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.terms;
  const pathname = `/${locale}/terms`;

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

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§1</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{t.acceptTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            {t.acceptBodyA}{' '}
            <Link
              href={localePath(locale, '/aup')}
              className="text-primary hover:text-primary-dim underline"
            >
              {t.acceptBodyAup}
            </Link>{' '}
            {t.acceptBodyB}{' '}
            <Link
              href={localePath(locale, '/privacy')}
              className="text-primary hover:text-primary-dim underline"
            >
              {t.acceptBodyPrivacy}
            </Link>
            {t.acceptBodyC}
          </p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {t.eligibilityTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.eligibilityBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{t.accountTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.accountBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{t.licenseTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.licenseBody1}</p>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.licenseBody2}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {t.prohibitedTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            {t.prohibitedBodyA}{' '}
            <Link
              href={localePath(locale, '/aup')}
              className="text-primary hover:text-primary-dim underline"
            >
              {t.prohibitedBodyLink}
            </Link>
            {t.prohibitedBodyB}
          </p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{t.ipTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            {t.ipBodyA}{' '}
            <Link
              href={localePath(locale, '/aup')}
              className="text-primary hover:text-primary-dim underline"
            >
              {t.ipBodyAupLink}
            </Link>
            {t.ipBodyB}{' '}
            <a
              href="https://github.com/Leeaandrob/aevia/blob/main/LICENSES.md"
              className="text-primary hover:text-primary-dim underline"
            >
              {t.ipBodyLicensesLink}
            </a>
            {t.ipBodyC}
          </p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {t.terminationTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.terminationBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§8</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{t.warrantyTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.warrantyBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§9</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {t.liabilityTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.liabilityBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§10</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {t.indemnityTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.indemnityBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§11</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {t.arbitrationTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            {t.arbitrationBodyA}{' '}
            <Link
              href={localePath(locale, '/aup')}
              className="text-primary hover:text-primary-dim underline"
            >
              {t.arbitrationBodyLink}
            </Link>
            {t.arbitrationBodyB}
          </p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§12</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{t.lawTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.lawBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§13</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            {t.modificationsTitle}
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.modificationsBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§14</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">{t.wholeTitle}</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{t.wholeBody}</p>
        </section>

        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8">
            <span className="font-label text-xs text-tertiary">{t.contactEyebrow}</span>
            <p className="mt-2 max-w-[72ch] text-base text-on-surface-variant leading-[1.7]">
              {t.contactBody1}{' '}
              <a
                href="mailto:contact@aevia.network?subject=terms inquiry"
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
