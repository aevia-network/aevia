import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { MeshDot } from '@aevia/ui';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-static';

const PORTALS = [
  {
    index: '01',
    slug: 'whitepaper',
    href: '/whitepaper',
    blurb:
      '17 páginas compiladas de 6 RFCs. arquitetura, identidade, persistência, AUP, governança, economia.',
  },
  {
    index: '02',
    slug: 'spec',
    href: '/spec',
    blurb:
      '6 RFCs normativos no estilo IETF. manifesto schema, content addressing, autenticação, AUP, persistence pool.',
  },
  {
    index: '03',
    slug: 'manifesto',
    href: '/manifesto',
    blurb: 'por que construímos o que construímos, na voz do fundador, em português e inglês.',
  },
];

const ROADMAP = [
  {
    label: 'shipped',
    milestone: '2026-04 · hello live end-to-end',
    blurb: 'whip + whep validados, manifesto assinado, content registry em sepolia.',
  },
  {
    label: 'in flight',
    milestone: '2026-04 · content registry + manifestos',
    blurb: 'cid canonicalization via webhook, fetch com auto-verificação no client.',
  },
  {
    label: 'next',
    milestone: '2026-Q2 · p2p media loader + risk score',
    blurb: 'integração libp2p no viewer, rfc-6 risk score publicado e ancorado.',
  },
];

export default function Landing() {
  return (
    <>
      <Nav />

      <main className="mx-auto max-w-[1440px] px-12">
        <section className="pt-[200px] pb-[160px]">
          <h1 className="max-w-[1200px] font-headline text-[96px] font-bold leading-[1.05] tracking-tight">
            persistência não implica distribuição
            <span className="inline-flex translate-y-3 items-center pl-1">
              <span className="pr-1">.</span>
              <MeshDot />
            </span>
          </h1>

          <p className="mt-10 max-w-[68ch] text-xl leading-[1.7] text-on-surface-variant">
            vídeo soberano para criadores silenciados. o protocolo aevia ancora manifestos em base
            l2 e paga nós de persistência em cUSDC para manter cópias disponíveis quando cdns
            comerciais falham.
          </p>
        </section>

        <section className="border-t border-primary-dim/30">
          {PORTALS.map((portal) => (
            <Link
              key={portal.slug}
              href={portal.href}
              className="group grid grid-cols-[280px_1fr] items-start gap-16 border-b border-primary-dim/30 py-12 transition-colors hover:bg-surface-low/40"
            >
              <div className="flex items-center gap-3 font-label text-sm">
                <span className="text-tertiary">{portal.index}</span>
                <span className="text-on-surface-variant">·</span>
                <span className="text-accent">{portal.slug}</span>
                <ArrowRight
                  className="ml-2 h-4 w-4 text-primary transition-transform group-hover:translate-x-1"
                  strokeWidth={1.5}
                />
              </div>
              <p className="max-w-[56ch] text-lg leading-[1.7]">{portal.blurb}</p>
            </Link>
          ))}
        </section>

        <section className="grid grid-cols-3 gap-12 py-[120px]">
          {ROADMAP.map((column) => (
            <div key={column.label} className="flex flex-col gap-4">
              <span className="font-label text-[13px] tracking-[0.04em] text-tertiary">
                {column.label}
              </span>
              <span className="text-base font-medium text-accent">{column.milestone}</span>
              <p className="text-sm leading-[1.6] text-on-surface-variant">{column.blurb}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col items-center gap-6 border-t border-primary-dim/30 py-[120px] text-center">
          <p className="max-w-[36ch] font-headline text-[36px] font-bold leading-[1.2] tracking-tight">
            aevia não distribui sem os nós de persistência. seja um.
          </p>
          <Link
            href="/providers"
            className="inline-flex items-center gap-2 font-label text-base text-primary-dim transition-colors hover:text-primary"
          >
            tornar-se um provider node
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </section>
      </main>

      <Footer />
    </>
  );
}
