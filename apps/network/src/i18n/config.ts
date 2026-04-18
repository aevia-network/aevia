export const locales = ['pt-BR', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt-BR';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
