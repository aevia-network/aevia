import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { pageMetadata } from '@/i18n/metadata';
import { localePath } from '@/i18n/navigation';
import { MeshDot } from '@aevia/ui';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
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
  return pageMetadata(locale, '/providers', getDictionary(locale).providers.meta);
}

export default async function Providers({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const p = dict.providers;
  const pathname = `/${locale}/providers`;

  return (
    <>
      <Nav locale={locale} dict={dict} pathname={pathname} />
      <main className="mx-auto max-w-[1440px] px-6 md:px-12">
        <section className="pt-[120px] md:pt-[200px]">
          <div className="mx-auto max-w-[72ch] text-center">
            <p className="font-label text-xs text-tertiary tracking-[0.04em]">{p.eyebrow}</p>
            <h1 className="mt-6 font-headline text-5xl md:text-[96px] font-bold leading-[1.05] tracking-tight text-accent">
              {p.title}
            </h1>
            <p className="mx-auto mt-8 max-w-[68ch] text-xl text-on-surface-variant leading-[1.7]">
              {p.subtitle}
            </p>
          </div>
        </section>

        <hr className="mt-24 border-primary-dim/40" />

        <section className="mt-24">
          <div className="mx-auto max-w-[72ch] space-y-6 text-lg leading-[1.7] text-on-surface-variant">
            {p.lead.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="mt-24">
          <div className="mx-auto grid max-w-[92ch] grid-cols-3 gap-8">
            {p.cards.map((card) => (
              <article
                key={card.n}
                className="flex min-h-[260px] flex-col gap-4 rounded-lg border border-primary-dim/30 bg-surface-container-low p-8"
              >
                <p className="font-mono text-xs text-tertiary">{card.n}</p>
                <h3 className="font-headline text-2xl font-bold leading-tight text-accent">
                  {card.title}
                </h3>
                <p className="text-base text-on-surface-variant leading-[1.7]">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <div className="mx-auto max-w-[72ch] rounded-lg border border-primary-dim/30 bg-surface-container-low p-8">
            <p className="font-label text-xs text-tertiary tracking-[0.04em]">{p.legalLabel}</p>
            <p className="mt-3 text-base leading-[1.7] text-on-surface-variant">{p.legalBody}</p>
          </div>
        </section>

        <section className="mt-20">
          <div className="mx-auto max-w-[72ch] rounded-lg border border-primary-dim/30 bg-surface-container-low p-10 text-center">
            <h2 className="font-headline text-3xl font-bold leading-tight text-accent">
              {p.waitlistTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-[56ch] text-base text-on-surface-variant leading-[1.7]">
              {p.waitlistBody}
            </p>
            <div className="mt-8">
              <a
                href="mailto:contact@aevia.network?subject=Provider Node — interest&body=Hardware%20specification:%0ABandwidth:%0ARegion:%0AOperational%20jurisdiction:%0AStorage%20capacity:%0AContact:"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-label text-sm text-accent transition-colors hover:bg-primary-dim"
              >
                {p.waitlistCta}
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </a>
            </div>
            <div className="mt-4">
              <Link
                href={localePath(locale, '/spec/rfc-5')}
                className="inline-flex items-center gap-1 font-label text-sm text-primary-dim hover:text-primary"
              >
                {p.waitlistRfc}
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-16 pb-[160px]">
          <div className="flex items-center justify-center gap-2 font-body text-sm italic text-on-surface-variant">
            <span>{p.signature}</span>
            <MeshDot />
          </div>
        </section>
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
