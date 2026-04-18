import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { defaultLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { localePath } from '@/i18n/navigation';
import { MeshDot } from '@aevia/ui';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  const locale = defaultLocale;
  const dict = getDictionary(locale);
  const n = dict.notFound;
  const pathname = `/${locale}`;

  return (
    <>
      <Nav locale={locale} dict={dict} pathname={pathname} />
      <main className="mx-auto flex min-h-[70vh] max-w-[1440px] items-center justify-center px-12">
        <div className="flex max-w-[56ch] flex-col items-center gap-6 text-center">
          <p className="font-mono text-sm tracking-[0.04em] text-tertiary">{n.label}</p>

          <h1 className="font-headline text-6xl font-bold leading-[1.1] tracking-tight">
            {n.headline}
          </h1>

          <p className="max-w-[48ch] text-lg leading-[1.7] text-on-surface-variant">{n.body}</p>

          <div className="mt-4 flex items-center gap-8">
            <Link
              href={localePath(locale)}
              className="inline-flex items-center gap-2 font-label text-base text-primary transition-colors hover:text-primary-dim"
            >
              {n.home}
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
            <Link
              href={localePath(locale, '/spec')}
              className="inline-flex items-center gap-2 font-label text-base text-primary transition-colors hover:text-primary-dim"
            >
              {n.spec}
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </div>

          <div className="mt-12 flex items-center gap-2 font-body text-sm italic text-on-surface-variant">
            <span>{n.quote}</span>
            <MeshDot />
          </div>
        </div>
      </main>
      <Footer locale={locale} dict={dict} />
    </>
  );
}
