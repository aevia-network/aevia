import type { Metadata } from 'next';
import { type Locale, locales } from './config';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aevia.network';

export function pageMetadata(
  locale: Locale,
  path: string,
  base: Pick<Metadata, 'title' | 'description'>,
): Metadata {
  const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  const canonical = `${BASE_URL}/${locale}${clean}`;
  const languages: Record<string, string> = {};
  for (const alt of locales) {
    languages[alt] = `${BASE_URL}/${alt}${clean}`;
  }
  languages['x-default'] = `${BASE_URL}/${locales[0]}${clean}`;

  const title = typeof base.title === 'string' ? base.title : undefined;
  const description = typeof base.description === 'string' ? base.description : undefined;

  return {
    ...base,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: 'aevia.network',
      locale: locale.replace('-', '_'),
      alternateLocale: locales.filter((l) => l !== locale).map((l) => l.replace('-', '_')),
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
