import { type Locale, locales } from './config';

export const TOP_ROUTES = [
  '/',
  '/whitepaper',
  '/manifesto',
  '/roadmap',
  '/providers',
  '/spec',
  '/aup',
  '/privacy',
  '/terms',
  '/transparency',
] as const;

export const SPEC_SLUGS = ['rfc-0', 'rfc-1', 'rfc-2', 'rfc-3', 'rfc-4', 'rfc-5'] as const;

export function allRoutes(): string[] {
  const routes = [...TOP_ROUTES.map(String)];
  for (const slug of SPEC_SLUGS) {
    routes.push(`/spec/${slug}`);
  }
  return routes;
}

export function alternatesFor(path: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  const clean = path === '/' ? '' : path;
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = `/${locale}${clean}`;
  }
  languages['x-default'] = `/${locales[0]}${clean}`;
  return {
    canonical: `/${locales[0]}${clean}`,
    languages,
  };
}

export function pathWithoutLocale(pathname: string, locale: Locale): string {
  const prefix = `/${locale}`;
  if (pathname === prefix) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}
