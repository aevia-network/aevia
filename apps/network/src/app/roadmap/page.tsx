import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'roadmap · aevia.network',
  description:
    'onde estamos, em que trabalhamos, para onde vamos. sem promessas de data, só estado atual.',
};

type Milestone = {
  date: string;
  headline: string;
  descriptor: string;
};

type Section = {
  label: string;
  title: string;
  blurb: string;
  milestones: Milestone[];
};

const sections: Section[] = [
  {
    label: '01 · shipped',
    title: 'o que já está de pé',
    blurb:
      'três milestones recentes que formam a base auditável do protocolo. cada um foi validado com teste integrado antes de subir.',
    milestones: [
      {
        date: '2026-04',
        headline: 'hello live end-to-end validado',
        descriptor:
          'whip de captura, whep de consumo, manifesto assinado em base sepolia, content registry deployado.',
      },
      {
        date: '2026-04',
        headline: 'content registry on-chain + manifestos assinados',
        descriptor:
          'contrato ContentRegistry em base sepolia. manifestos canônicos json com verificação offline.',
      },
      {
        date: '2026-04',
        headline: 'rfc-4 (aup) e rfc-5 (persistence pool) publicados',
        descriptor: 'políticas normativas fundacionais do protocolo escritas em estilo ietf.',
      },
    ],
  },
  {
    label: '02 · in flight',
    title: 'o que estamos construindo agora',
    blurb:
      'trabalho ativo da sprint corrente. cada item tem teste integrado como critério de pronto.',
    milestones: [
      {
        date: 'sprint 2',
        headline: 'cid canonicalization via webhook cloudflare stream',
        descriptor:
          'converter uid do stream em cid canônico e assinar o manifesto automaticamente após o encoding.',
      },
      {
        date: 'sprint 2',
        headline: 'client fetch com auto-verificação por cid',
        descriptor:
          'viewer busca manifesto e segmentos pelo cid, verifica hash, rejeita qualquer mismatch.',
      },
      {
        date: 'sprint 2',
        headline: 'p2p: dht kademlia + circuit relay v2 no provider node',
        descriptor:
          'discovery transitivo em 3 nós e rota relay atrás de nat hostil. teste kill-switch passando.',
      },
    ],
  },
  {
    label: '03 · next',
    title: 'onde vamos em seguida',
    blurb:
      'os três próximos focos depois desta sprint. nenhum tem data fechada; todos têm rfc ou adr em rascunho.',
    milestones: [
      {
        date: 'sprint 3',
        headline: 'p2p media loader integrado ao viewer',
        descriptor:
          'libp2p stream no client web, fallback para cdn quando o mesh não tem a peça em tempo.',
      },
      {
        date: 'sprint 3',
        headline: 'rfc-6 risk score publicado e ancorado',
        descriptor:
          'fórmula R = 0.4·r_legal + 0.3·r_abuse + 0.3·r_values, scoring off-chain, conselho com veto.',
      },
      {
        date: 'sprint 4',
        headline: 'rfc-7 moderação e jury ecumênica',
        descriptor:
          '12 assentos, 4 anos, direito de veto em parâmetros. primeira convocação em testnet.',
      },
    ],
  },
];

export default function Roadmap() {
  return (
    <>
      <Nav active="roadmap" locale="pt-BR" />
      <main className="mx-auto max-w-[1440px] px-12">
        <section className="pt-[200px]">
          <div className="max-w-[72ch] mx-auto">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">
              protocolo · roadmap
            </span>
            <h1 className="font-headline text-[96px] font-bold leading-[1.05] tracking-tight mt-4">
              roadmap
            </h1>
            <p className="text-xl text-on-surface-variant leading-[1.7] max-w-[68ch] mt-8">
              onde estamos, em que trabalhamos, para onde vamos. sem promessas de data, só estado
              atual do protocolo.
            </p>
            <p className="font-mono text-sm text-on-surface-variant mt-8">
              atualizado em 2026-04-17 · versão do documento: v0.1
            </p>
          </div>
        </section>

        <div className="border-t border-primary-dim/40 mt-24" />

        {sections.map((section, sectionIndex) => {
          const isLast = sectionIndex === sections.length - 1;
          return (
            <section
              key={section.label}
              className={isLast ? 'py-16' : 'py-16 border-b border-primary-dim/30'}
            >
              <header className="grid grid-cols-[280px_1fr] gap-16 items-baseline">
                <div>
                  <span className="font-label text-xs text-tertiary tracking-[0.04em]">
                    {section.label}
                  </span>
                  <h2 className="font-headline text-4xl font-bold mt-2 leading-tight">
                    {section.title}
                  </h2>
                </div>
                <p className="text-lg text-on-surface-variant leading-[1.7] max-w-[72ch]">
                  {section.blurb}
                </p>
              </header>

              <ol className="mt-10 ml-[296px] flex flex-col gap-8">
                {section.milestones.map((milestone) => (
                  <li
                    key={`${section.label}-${milestone.headline}`}
                    className="flex items-baseline gap-6"
                  >
                    <span className="font-mono text-sm text-primary shrink-0 w-20">
                      {milestone.date}
                    </span>
                    <span className="text-outline-variant">·</span>
                    <div className="flex-1 max-w-[64ch]">
                      <p className="text-base text-accent font-medium">{milestone.headline}</p>
                      <p className="text-sm text-on-surface-variant mt-1 leading-[1.6]">
                        {milestone.descriptor}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}

        <div className="pb-[160px]" />
      </main>
      <Footer />
    </>
  );
}
