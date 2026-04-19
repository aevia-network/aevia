import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { pageMetadata } from '@/i18n/metadata';
import { MeshDot } from '@aevia/ui';
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
  return pageMetadata(locale, '/manifesto', getDictionary(locale).manifesto.meta);
}

export default async function Manifesto({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const m = dict.manifesto;
  const pathname = `/${locale}/manifesto`;

  return (
    <>
      <Nav active="manifesto" locale={locale} dict={dict} pathname={pathname} />

      <main className="mx-auto max-w-[1440px] px-6 md:px-12">
        <article className="mx-auto max-w-[72ch] pt-[120px] md:pt-[200px] pb-[80px] md:pb-[120px]">
          <header className="flex flex-col gap-6">
            <span className="font-label text-[13px] tracking-[0.04em] text-tertiary">
              {m.eyebrow}
            </span>
            <h1 className="font-headline text-5xl md:text-[96px] font-bold leading-[1.05] tracking-tight">
              {m.title}
            </h1>
            <p className="text-base text-on-surface-variant">{m.byline}</p>
          </header>

          <hr className="my-[120px] h-px border-0 bg-primary-dim/40" />

          <div className="flex flex-col gap-8 text-lg leading-[1.7]">
            {m.paragraphsBeforeQuote.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <figure className="my-[96px] flex flex-col items-center gap-4">
            <MeshDot />
            <blockquote className="max-w-[56ch] text-center font-headline text-[56px] font-bold leading-[1.2] tracking-tight text-primary">
              {m.quote}
            </blockquote>
          </figure>

          <div className="flex flex-col gap-8 text-lg leading-[1.7]">
            {m.paragraphsBetween.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div aria-hidden className="my-[96px] flex items-center justify-center gap-4">
            <span className="h-2 w-2 rounded-full bg-tertiary/60" />
            <span className="h-2 w-2 rounded-full bg-tertiary/60" />
            <span className="h-2 w-2 rounded-full bg-tertiary/60" />
          </div>

          <div className="flex flex-col gap-8 text-lg leading-[1.7]">
            {m.paragraphsAfterBreak.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <footer className="mt-[96px] flex items-center justify-end gap-2">
            <span className="font-body text-base italic text-on-surface-variant">
              {m.signature}
            </span>
            <MeshDot />
          </footer>
        </article>
      </main>

      <Footer locale={locale} dict={dict} />
    </>
  );
}
