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
  return pageMetadata(locale, '/faq', getDictionary(locale).faq.meta);
}

export default async function Faq({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const f = dict.faq;
  const pathname = `/${locale}/faq`;

  return (
    <>
      <Nav active="faq" locale={locale} dict={dict} pathname={pathname} />
      <main className="mx-auto max-w-[1440px] px-6 md:px-12">
        <section className="mx-auto max-w-[72ch] pt-[120px] md:pt-[200px]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">{f.eyebrow}</span>
          <h1 className="mt-6 font-headline text-5xl md:text-[96px] font-bold leading-[1.05] tracking-tight">
            {f.title}
          </h1>
          <p className="mt-8 max-w-[68ch] text-lg md:text-xl text-on-surface-variant leading-[1.7]">
            {f.subtitle}
          </p>
          <p className="mt-8 font-mono text-sm text-on-surface-variant">{f.stamp}</p>
        </section>

        <div className="mx-auto mt-24 max-w-[72ch] border-t border-primary-dim/40" />

        <section className="mx-auto mt-24 max-w-[72ch]">
          <p className="max-w-[72ch] text-base md:text-lg leading-[1.7] text-on-surface-variant">
            {f.lead}
          </p>
        </section>

        <nav
          className="mx-auto mt-16 max-w-[72ch]"
          aria-label={locale === 'pt-BR' ? 'navegação do faq' : 'faq navigation'}
        >
          <ul className="flex flex-wrap gap-4 font-label text-sm">
            {f.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="rounded-lg border border-primary-dim/40 bg-surface-container-low px-4 py-2 hover:bg-surface-container transition-colors"
                >
                  {section.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {f.sections.map((section, sectionIdx) => (
          <section
            key={section.id}
            id={section.id}
            className="mx-auto mt-24 max-w-[72ch] scroll-mt-[100px]"
          >
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">
              §{sectionIdx + 1}
            </span>
            <h2 className="mt-2 font-headline text-3xl md:text-4xl font-bold leading-tight">
              {section.heading}
            </h2>
            <div className="mt-10 space-y-10">
              {section.items.map((item, itemIdx) => (
                <article key={`${section.id}-${itemIdx}`}>
                  <h3 className="font-headline text-xl md:text-2xl font-semibold leading-tight text-primary">
                    {item.q}
                  </h3>
                  <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">{item.a}</p>
                </article>
              ))}
            </div>
          </section>
        ))}

        <section className="mx-auto mt-32 mb-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/40 bg-surface-container-low p-8 md:p-10">
            <h2 className="font-headline text-2xl md:text-3xl font-bold leading-tight">
              {f.cta.heading}
            </h2>
            <p className="mt-4 text-base leading-[1.7] text-on-surface-variant">{f.cta.body}</p>
            <div className="mt-8 flex flex-wrap gap-4 font-label text-sm">
              <a
                href="https://github.com/aevia-network/aevia/issues/new"
                target="_blank"
                rel="noopener"
                className="rounded-lg border border-primary-dim/60 bg-primary/10 px-5 py-3 hover:bg-primary/20 transition-colors"
              >
                {f.cta.github}
              </a>
              <a
                href="mailto:contact@aevia.network"
                className="rounded-lg border border-primary-dim/40 px-5 py-3 hover:bg-surface-container transition-colors"
              >
                {f.cta.email}
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
