import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

const CONTENT_REGISTRY = '0x07ff…5592F0';
const SPEC_VERSION = 'v0.1';
const SOURCE_URL = 'https://github.com/Leeaandrob/aevia';

export function Footer() {
  return (
    <footer className="border-t border-outline-variant/40 bg-background">
      <div className="mx-auto grid max-w-[1440px] grid-cols-4 gap-12 px-12 pt-24 pb-12">
        <div className="flex flex-col gap-3 font-label text-sm">
          <span className="text-tertiary">site</span>
          <Link href="/spec" className="text-on-surface-variant hover:text-accent">
            spec
          </Link>
          <Link href="/manifesto" className="text-on-surface-variant hover:text-accent">
            manifesto
          </Link>
          <Link href="/roadmap" className="text-on-surface-variant hover:text-accent">
            roadmap
          </Link>
          <Link href="/providers" className="text-on-surface-variant hover:text-accent">
            provider nodes
          </Link>
        </div>

        <div className="flex flex-col gap-3 font-label text-sm">
          <span className="text-tertiary">legal</span>
          <Link href="/aup" className="text-on-surface-variant hover:text-accent">
            aup
          </Link>
          <Link href="/privacy" className="text-on-surface-variant hover:text-accent">
            privacy
          </Link>
          <Link href="/terms" className="text-on-surface-variant hover:text-accent">
            terms
          </Link>
          <a
            href="mailto:contact@aevia.network?subject=dmca takedown"
            className="text-on-surface-variant hover:text-accent"
          >
            dmca
          </a>
        </div>

        <div className="flex flex-col gap-3 font-label text-sm">
          <span className="text-tertiary">contato · código-fonte</span>
          <a
            href="mailto:contact@aevia.network"
            className="font-mono text-on-surface-variant hover:text-accent"
          >
            contact@aevia.network
          </a>
          <a
            href={SOURCE_URL}
            className="inline-flex items-center gap-1 text-on-surface-variant hover:text-accent"
          >
            fonte (agpl-3.0)
            <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
          </a>
          <span className="font-mono text-xs text-muted leading-[1.6]">
            agpl-3.0 §13: o código-fonte desta superfície de rede está disponível publicamente no
            repositório acima.
          </span>
        </div>

        <div className="flex flex-col gap-3 font-label text-sm">
          <span className="text-tertiary">protocolo · jurisdição</span>
          <span className="font-mono text-on-surface-variant">
            ContentRegistry {CONTENT_REGISTRY}
          </span>
          <span className="font-mono text-on-surface-variant">Base Sepolia (testnet)</span>
          <span className="font-mono text-on-surface-variant">protocolo {SPEC_VERSION}</span>
          <span className="mt-2 text-on-surface-variant">© 2026 Aevia LLC · Delaware, USA</span>
        </div>
      </div>
    </footer>
  );
}
