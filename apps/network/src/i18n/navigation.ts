import type { Locale } from './config';

export function localePath(locale: Locale, path = '/'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === '/') return `/${locale}`;
  return `/${locale}${normalized}`;
}

export function switchLocalePath(targetLocale: Locale, currentPath: string): string {
  const segments = currentPath.split('/').filter(Boolean);
  if (segments.length === 0) return `/${targetLocale}`;
  segments[0] = targetLocale;
  return `/${segments.join('/')}`;
}
