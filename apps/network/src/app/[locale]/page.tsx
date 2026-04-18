import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { pageMetadata } from '@/i18n/metadata';
import { localePath } from '@/i18n/navigation';
import { MeshDot } from '@aevia/ui';
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
  return pageMetadata(locale, '/', {
    title: 'aevia.network — sovereign video protocol',
    description: getDictionary(locale).landing.hero.subtitle,
  });
}

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { landing } = dict;
  const pathname = `/${locale}`;

  return (
    <>
      <Nav locale={locale} dict={dict} pathname={pathname} />

      <main className="mx-auto max-w-[1440px] px-12">
        <section className="pt-[200px] pb-[160px]">
          <h1 className="max-w-[1200px] font-headline text-[96px] font-bold leading-[1.05] tracking-tight">
            {landing.hero.titleBefore}
            <span className="inline-flex translate-y-3 items-center pl-1">
              <span className="pr-1">.</span>
              <MeshDot />
            </span>
          </h1>

          <p className="mt-10 max-w-[68ch] text-xl leading-[1.7] text-on-surface-variant">
            {landing.hero.subtitle}
          </p>
        </section>

        <section className="border-t border-primary-dim/30">
          {landing.portals.map((portal) => (
            <Link
              key={portal.slug}
              href={localePath(locale, portal.href)}
              className="group grid grid-cols-[280px_1fr] items-start gap-16 border-b border-primary-dim/30 py-12 transition-colors hover:bg-surface-low/40"
            >
              <div className="flex items-center gap-3 font-label text-sm">
                <span className="text-tertiary">{portal.index}</span>
                <span className="text-on-surface-variant">·</span>
                <span className="text-accent">{portal.slug}</span>
                <ArrowRight
                  className="ml-2 h-4 w-4 text-primary transition-transform group-hover:translate-x-1"
                  strokeWidth={1.5}
                />
              </div>
              <p className="max-w-[56ch] text-lg leading-[1.7]">{portal.blurb}</p>
            </Link>
          ))}
        </section>

        <section className="border-t border-primary-dim/30 py-[120px]">
          <div className="grid grid-cols-[280px_1fr] gap-16">
            <div>
              <span className="font-label text-[13px] tracking-[0.04em] text-tertiary">
                {landing.personas.heading}
              </span>
            </div>
            <div className="flex flex-col gap-10">
              <p className="max-w-[68ch] text-lg leading-[1.7] text-on-surface-variant">
                {landing.personas.lead}
              </p>
              <ul className="grid grid-cols-2 gap-x-12 gap-y-6">
                {landing.personas.items.map((persona) => (
                  <li key={persona.tag} className="flex flex-col gap-2">
                    <span className="font-label text-sm tracking-[0.02em] text-accent">
                      {persona.tag}
                    </span>
                    <p className="text-sm leading-[1.6] text-on-surface-variant">{persona.line}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-12 border-t border-primary-dim/30 py-[120px]">
          {landing.roadmap.map((column) => (
            <div key={column.label} className="flex flex-col gap-4">
              <span className="font-label text-[13px] tracking-[0.04em] text-tertiary">
                {column.label}
              </span>
              <span className="text-base font-medium text-accent">{column.milestone}</span>
              <p className="text-sm leading-[1.6] text-on-surface-variant">{column.blurb}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col items-center gap-6 border-t border-primary-dim/30 py-[120px] text-center">
          <p className="max-w-[36ch] font-headline text-[36px] font-bold leading-[1.2] tracking-tight">
            {landing.closing.headline}
          </p>
          <Link
            href={localePath(locale, '/providers')}
            className="inline-flex items-center gap-2 font-label text-base text-primary-dim transition-colors hover:text-primary"
          >
            {landing.closing.cta}
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </section>
      </main>

      <Footer locale={locale} dict={dict} />
    </>
  );
}
