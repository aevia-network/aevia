import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

const CONTENT_REGISTRY = '0x07ff…5592F0';
const SPEC_VERSION = 'v0.1';

export function Footer() {
  return (
    <footer className="border-t border-outline-variant/40 bg-background">
      <div className="mx-auto grid max-w-[1440px] grid-cols-4 gap-12 px-12 pt-24 pb-12">
        <div className="flex flex-col gap-3 font-label text-sm">
          <span className="text-tertiary">site</span>
          <Link href="/aup" className="text-on-surface-variant hover:text-accent">
            aup
          </Link>
          <Link href="/manifesto" className="text-on-surface-variant hover:text-accent">
            manifesto
          </Link>
          <Link href="/roadmap" className="text-on-surface-variant hover:text-accent">
            roadmap
          </Link>
          <a
            href="mailto:contact@aevia.network?subject=contato"
            className="flex items-center gap-1 text-on-surface-variant hover:text-accent"
          >
            fonte
            <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
          </a>
        </div>

        <div className="flex flex-col gap-3 font-label text-sm">
          <span className="text-tertiary">contato</span>
          <a
            href="mailto:contact@aevia.network"
            className="font-mono text-on-surface-variant hover:text-accent"
          >
            contact@aevia.network
          </a>
        </div>

        <div className="flex flex-col gap-3 font-label text-sm">
          <span className="text-tertiary">protocolo</span>
          <span className="font-mono text-on-surface-variant">
            ContentRegistry {CONTENT_REGISTRY}
          </span>
          <span className="font-mono text-on-surface-variant">Base Sepolia</span>
          <span className="font-mono text-on-surface-variant">protocolo {SPEC_VERSION}</span>
        </div>

        <div className="flex flex-col gap-3 font-label text-sm">
          <span className="text-tertiary">jurisdição</span>
          <span className="text-on-surface-variant">© 2026 Aevia LLC</span>
          <span className="text-on-surface-variant">Delaware, USA</span>
        </div>
      </div>
    </footer>
  );
}
