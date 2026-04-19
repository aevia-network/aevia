import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { PrintButton } from '@/components/print-button';
import { isLocale } from '@/i18n/config';
import { WhitepaperBodyByLocale } from '@/i18n/content';
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
  return pageMetadata(locale, '/whitepaper', getDictionary(locale).whitepaper.meta);
}

export default async function Whitepaper({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const w = dict.whitepaper;
  const pathname = `/${locale}/whitepaper`;

  return (
    <>
      <Nav active="whitepaper" locale={locale} dict={dict} pathname={pathname} />
      <main className="bg-background text-accent">
        <div className="mx-auto w-full max-w-[1440px] px-6 md:px-8 pb-32">
          <div className="grid grid-cols-1 gap-8 lg:gap-16 lg:grid-cols-[280px_minmax(0,92ch)_1fr]">
            <aside data-print-hide="true" className="sticky top-[100px] hidden self-start lg:block">
              <div className="pt-[200px]">
                <span className="font-label text-xs tracking-[0.04em] text-tertiary">
                  {w.contents}
                </span>
                <nav className="mt-6 flex flex-col gap-3">
                  {w.toc.map((item, idx) => {
                    const isActive = idx === 0;
                    return (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={
                          isActive
                            ? 'border-l-2 border-primary pl-3 font-label text-sm text-accent'
                            : 'pl-3 font-label text-sm text-on-surface-variant'
                        }
                      >
                        {item.label}
                      </a>
                    );
                  })}
                </nav>
                <div className="mt-16 flex flex-col gap-2">
                  <span className="font-mono text-xs text-on-surface-variant">{w.version}</span>
                  <PrintButton label={w.downloadPdf} />
                </div>
              </div>
            </aside>

            <article className="max-w-[92ch]">
              <header className="pt-[120px] md:pt-[200px]">
                <div className="flex items-center gap-3">
                  <MeshDot />
                  <span className="font-label text-xs tracking-[0.04em] text-tertiary">
                    {w.eyebrow}
                  </span>
                </div>
                <h1 className="mt-8 font-headline text-5xl md:text-7xl lg:text-[112px] font-bold leading-[1.05] tracking-tight">
                  {w.title}
                </h1>
                <p className="mt-6 max-w-[72ch] text-lg md:text-2xl text-on-surface-variant">{w.subtitle}</p>
                <p className="mt-8 font-mono text-sm text-on-surface-variant">{w.author}</p>
              </header>

              <div className="mt-16 rounded-lg border border-primary-dim/30 bg-surface-container-low p-6">
                <span className="font-label text-xs tracking-[0.04em] text-tertiary">
                  {w.legalNoteLabel}
                </span>
                <p className="mt-2 text-sm leading-[1.7] text-on-surface-variant">{w.legalNote}</p>
              </div>

              <div className="mt-[120px] h-px w-full bg-primary-dim/40" />

              <WhitepaperBodyByLocale locale={locale} />
            </article>

            <div aria-hidden="true" />
          </div>
        </div>
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
