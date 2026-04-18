import type { ReactNode } from 'react';
import type { Locale } from '../config';
import { WhitepaperBody as WhitepaperBodyEn } from './whitepaper.en';
import { WhitepaperBody as WhitepaperBodyPtBR } from './whitepaper.pt-BR';

export function WhitepaperBodyByLocale({ locale }: { locale: Locale }): ReactNode {
  return locale === 'en' ? <WhitepaperBodyEn /> : <WhitepaperBodyPtBR />;
}
