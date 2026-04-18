import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'spec · aevia.network',
  description: 'índice dos rfcs normativos do protocolo aevia.',
};

type Status = 'publicado' | 'rascunho' | 'planejado';

type SpecRow = {
  slug: string;
  titulo: string;
  status: Status;
  updated: string;
};

type SpecCard = {
  n: number;
  slug: string;
  titulo: string;
  abstract: string;
  sections: number;
};

const rows: SpecRow[] = [
  { slug: 'rfc-0', titulo: 'visão geral do protocolo', status: 'publicado', updated: '2026-04-14' },
  { slug: 'rfc-1', titulo: 'manifest schema', status: 'publicado', updated: '2026-04-15' },
  { slug: 'rfc-2', titulo: 'content addressing', status: 'publicado', updated: '2026-04-15' },
  {
    slug: 'rfc-3',
    titulo: 'autenticação e assinatura',
    status: 'publicado',
    updated: '2026-04-16',
  },
  { slug: 'rfc-4', titulo: 'acceptable use policy', status: 'publicado', updated: '2026-04-16' },
  { slug: 'rfc-5', titulo: 'persistence pool', status: 'publicado', updated: '2026-04-16' },
  { slug: 'rfc-6', titulo: 'risk score', status: 'planejado', updated: 'sprint 3' },
  { slug: 'rfc-7', titulo: 'moderação', status: 'planejado', updated: 'sprint 4' },
];

const cards: SpecCard[] = [
  {
    n: 0,
    slug: 'rfc-0',
    titulo: 'visão geral',
    abstract: 'como as camadas se encaixam. qual a tese. o que está em escopo e o que não está.',
    sections: 14,
  },
  {
    n: 1,
    slug: 'rfc-1',
    titulo: 'manifest schema',
    abstract:
      'estrutura json assinada que descreve cada conteúdo: cid, criador, segmentos, metadados, assinatura.',
    sections: 14,
  },
  {
    n: 2,
    slug: 'rfc-2',
    titulo: 'content addressing',
    abstract: 'cid, ipfs, gateways e a garantia de imutabilidade do conteúdo na base l2.',
    sections: 14,
  },
  {
    n: 3,
    slug: 'rfc-3',
    titulo: 'autenticação e assinatura',
    abstract: 'privy embedded wallet em base, eip-712, verificação offline sem gas.',
    sections: 14,
  },
  {
    n: 4,
    slug: 'rfc-4',
    titulo: 'acceptable use policy',
    abstract: 'o que a aevia não amplifica, por que isso preserva section 230, procedimentos dmca.',
    sections: 14,
  },
  {
    n: 5,
    slug: 'rfc-5',
    titulo: 'persistence pool',
    abstract:
      'como cusdc flui para os nós que provam replicação, fórmula de pagamento e monitoramento.',
    sections: 14,
  },
];

function StatusPill({ status }: { status: Status }) {
  if (status === 'publicado') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-tertiary/10 px-2.5 py-0.5 text-xs text-tertiary">
        publicado
      </span>
    );
  }
  if (status === 'rascunho') {
    return (
      <span className="inline-flex items-center rounded-full border border-secondary/50 px-2.5 py-0.5 text-xs text-secondary">
        rascunho
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-outline-variant/50 px-2.5 py-0.5 text-xs italic text-on-surface-variant">
      planejado
    </span>
  );
}

export default function SpecIndex() {
  return (
    <>
      <Nav active="spec" locale="pt-BR" />
      <main className="mx-auto max-w-[1440px] px-12">
        {/* Masthead */}
        <section className="mx-auto max-w-[72ch] pt-[200px]">
          <p className="font-label text-xs tracking-[0.04em] text-tertiary">protocolo · spec</p>
          <h1 className="mt-6 font-headline text-[96px] font-bold leading-[1.05] tracking-tight text-accent">
            specification
          </h1>
          <p className="mt-8 max-w-[68ch] text-xl leading-[1.7] text-on-surface-variant">
            seis documentos normativos no estilo ietf. regem manifesto schema, content addressing,
            identidade, aup, persistence pool e risk score.
          </p>
          <p className="mt-8 font-mono text-sm text-on-surface-variant">
            versão 0.1 · fonte canônica github.com/Leeaandrob/aevia/tree/main/docs/protocol-spec
          </p>
        </section>

        {/* Divider */}
        <div className="mx-auto mt-24 max-w-[92ch] border-t border-primary-dim/40" />

        {/* Cover prose */}
        <section className="mx-auto mt-24 flex max-w-[72ch] flex-col gap-6">
          <p className="text-lg leading-[1.7] text-on-surface-variant">
            rfcs da aevia seguem o estilo ietf e usam rfc 2119 para linguagem normativa — MUST e
            SHOULD têm peso. são ao mesmo tempo a fonte da verdade para implementadores e o contrato
            público que investidores e juristas podem ler.
          </p>
          <p className="text-lg leading-[1.7] text-on-surface-variant">
            cada rfc é versionado no repositório e ancorado em base l2 quando publicado. o índice
            abaixo mostra o estado atual. a renderização individual está em /spec/{'{slug}'}.
          </p>
        </section>

        {/* Status table */}
        <section className="mx-auto mt-20 max-w-[92ch]">
          <table className="w-full border-collapse font-label text-sm">
            <thead>
              <tr className="text-left">
                <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                  slug
                </th>
                <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                  título
                </th>
                <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                  status
                </th>
                <th className="border-b border-primary-dim/40 pb-3 text-xs tracking-[0.04em] text-tertiary">
                  última atualização
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug} className="border-b border-primary-dim/20">
                  <td className="py-3 pr-6 font-mono text-accent">{row.slug}</td>
                  <td className="py-3 pr-6 text-accent">{row.titulo}</td>
                  <td className="py-3 pr-6">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="py-3 text-on-surface-variant">{row.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Card grid */}
        <section className="mx-auto mt-24 max-w-[92ch]">
          <p className="mb-6 font-label text-xs tracking-[0.04em] text-tertiary">documentos</p>
          <div className="grid grid-cols-2 gap-12">
            {cards.map((card) => (
              <Link
                key={card.slug}
                href={`/spec/${card.slug}`}
                className="group flex min-h-[240px] flex-col gap-5 rounded-lg border border-primary-dim/30 bg-surface-container-low p-8 transition-colors hover:bg-surface-low/60"
              >
                <div className="flex items-start justify-between">
                  <span className="font-label text-xs tracking-[0.04em] text-tertiary">
                    {card.slug}
                  </span>
                  <StatusPill status="publicado" />
                </div>
                <h2 className="font-headline text-2xl font-bold leading-tight text-accent">
                  {card.titulo}
                </h2>
                <p className="max-w-[56ch] flex-grow text-base leading-[1.6] text-on-surface-variant">
                  {card.abstract}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-on-surface-variant">
                    {card.sections} seções
                  </span>
                  <span className="inline-flex items-center gap-1 font-label text-sm text-primary">
                    ler documento
                    <ArrowRight
                      size={14}
                      strokeWidth={1.5}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* References */}
        <section className="mx-auto mt-24 max-w-[92ch] border-t border-primary-dim/30 pt-12 pb-24">
          <p className="font-label text-xs tracking-[0.04em] text-tertiary">referências</p>
          <ol className="mt-6 list-decimal space-y-2 pl-6 font-mono text-sm text-on-surface-variant">
            <li>IETF RFC 2119 — Key words for RFCs</li>
            <li>IPFS Whitepaper — Benet (2014)</li>
            <li>Ethereum EIP-712 — Typed structured data hashing</li>
            <li>DMCA §512 — Safe harbor procedure</li>
            <li>Section 230 (47 U.S.C. §230) — Intermediary immunity</li>
          </ol>
        </section>
      </main>
      <Footer />
    </>
  );
}
