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
  return pageMetadata(locale, '/roadmap', getDictionary(locale).roadmap.meta);
}

export default async function Roadmap({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const r = dict.roadmap;
  const pathname = `/${locale}/roadmap`;

  return (
    <>
      <Nav active="roadmap" locale={locale} dict={dict} pathname={pathname} />
      <main className="mx-auto max-w-[1440px] px-6 md:px-12">
        <section className="pt-[120px] md:pt-[200px]">
          <div className="max-w-[72ch] mx-auto">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">{r.eyebrow}</span>
            <h1 className="font-headline text-5xl md:text-[96px] font-bold leading-[1.05] tracking-tight mt-4">
              {r.title}
            </h1>
            <p className="text-xl text-on-surface-variant leading-[1.7] max-w-[68ch] mt-8">
              {r.subtitle}
            </p>
            <p className="font-mono text-sm text-on-surface-variant mt-8">{r.stamp}</p>
          </div>
        </section>

        <div className="border-t border-primary-dim/40 mt-24" />

        <section className="mx-auto max-w-[72ch] mt-16">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-6">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">
              {r.forwardLookingLabel}
            </span>
            <p className="mt-2 text-sm text-on-surface-variant leading-[1.7]">
              {r.forwardLookingText}
            </p>
          </div>
        </section>

        {r.sections.map((section, sectionIndex) => {
          const isLast = sectionIndex === r.sections.length - 1;
          return (
            <section
              key={section.label}
              className={isLast ? 'py-16' : 'py-16 border-b border-primary-dim/30'}
            >
              <header className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 md:gap-16 items-baseline">
                <div>
                  <span className="font-label text-xs text-tertiary tracking-[0.04em]">
                    {section.label}
                  </span>
                  <h2 className="font-headline text-4xl font-bold mt-2 leading-tight">
                    {section.title}
                  </h2>
                </div>
                <p className="text-lg text-on-surface-variant leading-[1.7] max-w-[72ch]">
                  {section.blurb}
                </p>
              </header>

              <ol className="mt-10 md:ml-[296px] flex flex-col gap-8">
                {section.milestones.map((milestone) => (
                  <li
                    key={`${section.label}-${milestone.headline}`}
                    className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6"
                  >
                    <span className="font-mono text-sm text-primary shrink-0 sm:w-20">
                      {milestone.date}
                    </span>
                    <span className="hidden sm:inline text-outline-variant">·</span>
                    <div className="flex-1 max-w-[64ch]">
                      <p className="text-base text-accent font-medium">{milestone.headline}</p>
                      <p className="text-sm text-on-surface-variant mt-1 leading-[1.6]">
                        {milestone.descriptor}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}

        <div className="pb-[160px]" />
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
