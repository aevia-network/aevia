import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { MeshDot } from '@aevia/ui';
import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'whitepaper · aevia.network',
  description:
    'aevia — vídeo soberano como infraestrutura. especificação do protocolo em sete capítulos: arquitetura, identidade, persistência, risco, governança e economia.',
};

const toc = [
  { id: 'sumario-executivo', label: '01 · sumário executivo' },
  { id: 'arquitetura', label: '02 · arquitetura' },
  { id: 'identidade', label: '03 · identidade e assinatura' },
  { id: 'persistencia', label: '04 · persistência' },
  { id: 'aup-e-risco', label: '05 · aup e risco' },
  { id: 'governanca', label: '06 · governança' },
  { id: 'economia', label: '07 · economia' },
];

const layers = [
  {
    token: 'L1',
    label: 'client · aevia.video + alt clients',
    description:
      'superfícies de consumo. nenhum cliente é privilegiado pelo protocolo; todos consomem manifestos assinados do mesmo registro.',
  },
  {
    token: 'L2',
    label: 'manifest · signed json on base l2',
    description:
      'cada manifesto é um documento eip-712 ancorado em base l2. a âncora é a fonte de verdade sobre autoria e timestamp.',
  },
  {
    token: 'L3',
    label: 'content · cid + ipfs',
    description:
      'o conteúdo em si é endereçado por cid. o manifesto aponta para o cid, nunca para uma url proprietária.',
  },
  {
    token: 'L4',
    label: 'persistence · cusdc → provider nodes',
    description:
      'nós de persistência recebem cusdc em base por manter cópias auditáveis. replicação é econômica, não voluntária.',
  },
  {
    token: 'L5',
    label: 'risk · off-chain governance',
    description:
      'o score de risco é calculado off-chain e determina elegibilidade a feed curado e ao persistence pool. não afeta a existência do bit.',
  },
  {
    token: 'L6',
    label: 'aup · normative policy + jury',
    description:
      'política normativa pública e júri rotativo. aup governa incentivos e distribuição, não a retenção bruta em ipfs.',
  },
];

const riskRows = [
  { dim: 'R_legal', weight: '0.4', source: 'DMCA/CCPA' },
  { dim: 'R_abuse', weight: '0.3', source: 'relatórios + jury' },
  { dim: 'R_values', weight: '0.3', source: 'AUP §4' },
];

const governanceCards = [
  {
    eyebrow: 'conselho',
    value: '12',
    description: 'assentos ecumênicos',
  },
  {
    eyebrow: 'mandato',
    value: '4',
    description: 'anos por assento',
  },
  {
    eyebrow: 'veto',
    value: 'sim',
    description: 'sobre parâmetros do protocolo',
  },
];

const flowTokens = [
  { label: 'viewer', accent: false },
  { label: 'credit pulse', accent: true },
  { label: 'creator', accent: false },
  { label: 'persistence pool', accent: true },
  { label: 'provider nodes', accent: false },
];

const references = [
  'IETF RFC 2119 — Key words for use in RFCs',
  'IPFS Whitepaper (2014) — Benet',
  'Ethereum EIP-712 — Typed structured data hashing',
  'ERC-20 — Token standard, OpenZeppelin reference',
  'DMCA §512 — Safe harbor for online service providers',
  'Section 230 (47 U.S.C. §230) — Intermediary immunity',
  '18 U.S.C. §2258A — NCMEC reporting obligation',
  'W3C WebRTC — WHIP/WHEP live media transport',
];

const manifestJson = `{
  "version": "0.1",
  "cid": "bafybeigd...",
  "creator": "0x7a...fe3b",
  "created_at": "2026-04-17T12:00:00Z",
  "signature": "0x4e2a...",
  "hls": {
    "master": "index.m3u8",
    "segments": 342
  }
}`;

export default function Whitepaper() {
  return (
    <>
      <Nav active="whitepaper" locale="pt-BR" />
      <main className="bg-background text-accent">
        <div className="mx-auto w-full max-w-[1440px] px-8 pb-32">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-[280px_minmax(0,92ch)_1fr]">
            {/* Left column — sticky TOC rail */}
            <aside className="sticky top-[100px] hidden self-start lg:block">
              <div className="pt-[200px]">
                <span className="font-label text-xs tracking-[0.04em] text-tertiary">contents</span>
                <nav className="mt-6 flex flex-col gap-3">
                  {toc.map((item, idx) => {
                    const isActive = idx === 0;
                    return (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={
                          isActive
                            ? 'font-label text-sm text-accent border-l-2 border-primary pl-3'
                            : 'font-label text-sm text-on-surface-variant pl-3'
                        }
                      >
                        {item.label}
                      </a>
                    );
                  })}
                </nav>
                <div className="mt-16 flex flex-col gap-2">
                  <span className="font-mono text-xs text-on-surface-variant">
                    v0.1 · abril de 2026
                  </span>
                  <a href="/whitepaper.pdf" className="font-label text-sm text-primary">
                    baixar pdf →
                  </a>
                </div>
              </div>
            </aside>

            {/* Middle column — main prose */}
            <article className="max-w-[92ch]">
              {/* Masthead */}
              <header className="pt-[200px]">
                <div className="flex items-center gap-3">
                  <MeshDot />
                  <span className="font-label text-xs tracking-[0.04em] text-tertiary">
                    protocolo · whitepaper
                  </span>
                </div>
                <h1 className="mt-8 font-headline text-[112px] font-bold leading-[1.05] tracking-tight">
                  aevia
                </h1>
                <p className="mt-6 max-w-[72ch] text-2xl text-on-surface-variant">
                  vídeo soberano como infraestrutura. uma especificação.
                </p>
                <p className="mt-8 font-mono text-sm text-on-surface-variant">
                  leandro barbosa · aevia llc · versão 0.1 · 2026-04-17
                </p>
              </header>

              <div className="mt-[120px] h-px w-full bg-primary-dim/40" />

              {/* §01 sumário executivo */}
              <section id="sumario-executivo" className="py-16">
                <span className="font-label text-xs tracking-[0.04em] text-tertiary">§01</span>
                <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
                  sumário executivo
                </h2>
                <div className="mt-8 flex flex-col gap-6 text-lg leading-[1.7]">
                  <p>
                    a aevia é um protocolo de vídeo soberano. criadores ancoram manifestos assinados
                    em base l2, o conteúdo é endereçado por cid, e nós de persistência pagos em
                    cusdc mantêm cópias auditáveis quando cdns comerciais falham.
                  </p>
                  <p>
                    a tese é que persistência e distribuição são problemas diferentes. persistência
                    é infraestrutura — uma vez ancorada, o conteúdo existe. distribuição é
                    governança — ranking, subsidy e feed são editoriais, não neutros. confundir as
                    duas é o erro arquitetural das plataformas atuais.
                  </p>
                </div>
              </section>

              {/* §02 arquitetura */}
              <section id="arquitetura" className="py-16">
                <span className="font-label text-xs tracking-[0.04em] text-tertiary">§02</span>
                <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
                  arquitetura
                </h2>
                <div className="mt-8 flex flex-col gap-6 text-lg leading-[1.7]">
                  <p>
                    o sistema se compõe em seis camadas. o inset abaixo descreve cada uma e como se
                    acoplam.
                  </p>
                </div>
                <div className="mt-8 rounded-lg border border-primary-dim/40 bg-surface-container-low p-8">
                  <div className="flex flex-col gap-4">
                    {layers.map((layer) => (
                      <div
                        key={layer.token}
                        className="flex items-start gap-6 border-b border-primary-dim/20 py-4 last:border-b-0 last:pb-0"
                      >
                        <span className="font-mono text-sm text-tertiary w-10 shrink-0">
                          {layer.token}
                        </span>
                        <div className="flex flex-col gap-2">
                          <span className="font-label text-sm text-accent">{layer.label}</span>
                          <p className="text-base leading-[1.6] text-on-surface-variant">
                            {layer.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* §03 identidade e assinatura */}
              <section id="identidade" className="py-16">
                <span className="font-label text-xs tracking-[0.04em] text-tertiary">§03</span>
                <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
                  identidade e assinatura
                </h2>
                <div className="mt-8 flex flex-col gap-6 text-lg leading-[1.7]">
                  <p>
                    cada manifesto é assinado com a wallet embedded do criador via privy. a chave
                    fica na base l2, a assinatura é verificável offline. veja abaixo a estrutura
                    canônica.
                  </p>
                </div>
                <pre className="mt-8 overflow-x-auto rounded-lg bg-surface-lowest p-6 font-mono text-sm text-on-surface-variant">
                  <code>{manifestJson}</code>
                </pre>
              </section>

              {/* §04 persistência */}
              <section id="persistencia" className="py-16">
                <span className="font-label text-xs tracking-[0.04em] text-tertiary">§04</span>
                <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
                  persistência
                </h2>
                <div className="mt-8 flex flex-col gap-6 text-lg leading-[1.7]">
                  <p>
                    cada nó recebe pagamento proporcional ao tempo de replicação provado. a fórmula
                    é simples e auditável.
                  </p>
                </div>
                <div className="mt-8 flex flex-col items-center gap-4 py-8 text-center">
                  <p className="font-headline text-2xl text-accent">
                    P = Σ (node_uptime × proof_of_replication × region_weight)
                  </p>
                  <p className="font-label text-xs text-on-surface-variant">
                    P = pagamento · node_uptime ∈ [0,1] · region_weight ∈ {'{'}
                    0.5, 1.0, 1.5{'}'}
                  </p>
                </div>
              </section>

              {/* §05 aup e risco */}
              <section id="aup-e-risco" className="py-16">
                <span className="font-label text-xs tracking-[0.04em] text-tertiary">§05</span>
                <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
                  aup e risco
                </h2>
                <div className="mt-8 flex flex-col gap-6 text-lg leading-[1.7]">
                  <p>
                    o risco é calculado em três dimensões ortogonais e ponderadas. a soma determina
                    se o conteúdo entra no feed curado, entra no persistence pool, ou fica apenas
                    raw no ipfs.
                  </p>
                </div>
                <table className="mt-8 w-full font-label text-sm">
                  <thead>
                    <tr className="border-b border-primary-dim/40 text-tertiary">
                      <th className="py-3 text-left font-label font-normal">dimensão</th>
                      <th className="py-3 text-left font-label font-normal">peso</th>
                      <th className="py-3 text-left font-label font-normal">fonte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskRows.map((row) => (
                      <tr key={row.dim} className="border-b border-primary-dim/20">
                        <td className="py-3 font-mono text-accent">{row.dim}</td>
                        <td className="py-3 font-mono text-on-surface-variant">{row.weight}</td>
                        <td className="py-3 text-on-surface-variant">{row.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* §06 governança */}
              <section id="governanca" className="py-16">
                <span className="font-label text-xs tracking-[0.04em] text-tertiary">§06</span>
                <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
                  governança
                </h2>
                <div className="mt-8 flex flex-col gap-6 text-lg leading-[1.7]">
                  <p>
                    a aevia é governada por um conselho ecumênico de 12 assentos, mandatos de 4
                    anos, e direito de veto sobre parâmetros do protocolo. a composição é pública no
                    trust ledger.
                  </p>
                </div>
                <div className="mt-8 grid grid-cols-3 gap-4">
                  {governanceCards.map((card) => (
                    <div key={card.eyebrow} className="rounded-lg bg-surface-container p-6">
                      <span className="font-label text-xs tracking-[0.04em] text-tertiary">
                        {card.eyebrow}
                      </span>
                      <p className="mt-3 font-headline text-4xl font-bold leading-none text-accent">
                        {card.value}
                      </p>
                      <p className="mt-3 font-label text-xs text-on-surface-variant">
                        {card.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* §07 economia */}
              <section id="economia" className="py-16">
                <span className="font-label text-xs tracking-[0.04em] text-tertiary">§07</span>
                <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
                  economia
                </h2>
                <div className="mt-8 flex flex-col gap-6 text-lg leading-[1.7]">
                  <p>
                    créditos fluem do espectador para o criador via credit pulse. uma fração é
                    retida para o persistence pool, que remunera os nós que mantêm cópias
                    auditáveis.
                  </p>
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-4 font-label text-sm">
                  {flowTokens.map((token, idx) => (
                    <span key={token.label} className="flex items-center gap-4">
                      <span className={token.accent ? 'text-secondary' : 'text-accent'}>
                        {token.label}
                      </span>
                      {idx < flowTokens.length - 1 ? (
                        <ArrowRight className="h-4 w-4 text-primary" strokeWidth={1.5} />
                      ) : null}
                    </span>
                  ))}
                </div>
              </section>

              {/* References */}
              <div className="border-t border-primary-dim/30 pt-12">
                <span className="font-label text-xs tracking-[0.04em] text-tertiary">
                  referências
                </span>
                <ol className="mt-6 list-decimal space-y-2 pl-6 font-mono text-sm text-on-surface-variant">
                  {references.map((ref) => (
                    <li key={ref}>{ref}</li>
                  ))}
                </ol>
              </div>
            </article>

            {/* Right column — breathing room */}
            <div aria-hidden="true" />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
