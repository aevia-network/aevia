import type { Locale } from '../../config';
import { rfc0En } from './rfc-0.en';
import { rfc0PtBR } from './rfc-0.pt-BR';
import { rfc1En } from './rfc-1.en';
import { rfc1PtBR } from './rfc-1.pt-BR';
import { rfc2En } from './rfc-2.en';
import { rfc2PtBR } from './rfc-2.pt-BR';
import { rfc3En } from './rfc-3.en';
import { rfc3PtBR } from './rfc-3.pt-BR';
import { rfc4En } from './rfc-4.en';
import { rfc4PtBR } from './rfc-4.pt-BR';
import { rfc5En } from './rfc-5.en';
import { rfc5PtBR } from './rfc-5.pt-BR';
import type { RFCContent } from './types';

export type RFCSlug = 'rfc-0' | 'rfc-1' | 'rfc-2' | 'rfc-3' | 'rfc-4' | 'rfc-5';

const table: Record<RFCSlug, Record<Locale, RFCContent>> = {
  'rfc-0': { 'pt-BR': rfc0PtBR, en: rfc0En },
  'rfc-1': { 'pt-BR': rfc1PtBR, en: rfc1En },
  'rfc-2': { 'pt-BR': rfc2PtBR, en: rfc2En },
  'rfc-3': { 'pt-BR': rfc3PtBR, en: rfc3En },
  'rfc-4': { 'pt-BR': rfc4PtBR, en: rfc4En },
  'rfc-5': { 'pt-BR': rfc5PtBR, en: rfc5En },
};

export function getRFCContent(slug: RFCSlug, locale: Locale): RFCContent {
  return table[slug][locale];
}
