import type { Locale } from './config';
import { en } from './dict/en';
import { ptBR } from './dict/pt-BR';

export type Dictionary = typeof ptBR;

const dictionaries: Record<Locale, Dictionary> = {
  'pt-BR': ptBR,
  en: en,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
