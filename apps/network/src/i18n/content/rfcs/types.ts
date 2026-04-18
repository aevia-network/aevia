import type { ReactNode } from 'react';

export type RFCTocEntry = { id: string; label: string };

export type RFCContent = {
  toc: RFCTocEntry[];
  Body: () => ReactNode;
};
