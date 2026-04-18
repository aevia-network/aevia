import { locales } from '@/i18n/config';
import { allRoutes } from '@/i18n/routes';
import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aevia.network';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return allRoutes().flatMap((route) =>
    locales.map((locale) => {
      const path = route === '/' ? `/${locale}` : `/${locale}${route}`;
      const languages: Record<string, string> = {};
      for (const alt of locales) {
        languages[alt] = `${BASE_URL}${route === '/' ? `/${alt}` : `/${alt}${route}`}`;
      }
      return {
        url: `${BASE_URL}${path}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: route === '/' ? 1 : 0.7,
        alternates: { languages },
      };
    }),
  );
}
