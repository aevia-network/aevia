import type { RFCContent } from './types';

const CANONICAL_URL =
  'https://github.com/aevia-network/aevia/blob/main/docs/protocol-spec/8-economic-architecture.md';

export const rfc8PtBR: RFCContent = {
  toc: [
    { id: 's1-abstract', label: 'abstract' },
    { id: 's2-treasuries', label: '§3 · 4 tesourarias' },
    { id: 's3-boost', label: '§4 · boost router' },
    { id: 's4-invariants', label: '§7 · invariantes' },
    { id: 's5-canonical', label: 'canônico em docs/' },
  ],
  Body() {
    return (
      <>
        <section id="s1-abstract" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">abstract</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            Arquitetura Econômica
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Especifica a <strong>arquitetura econômica</strong> do protocolo Aevia: quais
              tesourarias custodiam cUSDC, quem controla cada uma, como fundos movem entre elas, e
              quais invariantes MUST valer o tempo todo. É a terceira perna do tripé de três
              documentos que sustenta a postura <em>não-é-oferta-de-securities</em>; as outras duas
              são RFC-4 (AUP) e RFC-5 (Persistence Pool).
            </p>
            <p>
              O commitment central de design é que o Persistence Pool é{' '}
              <strong>não-discricionário</strong>. Aevia LLC pré-funda durante bootstrap e daí em
              diante não tem claim sobre o saldo; desembolsos são programáticos por RFC-5. Essa é a
              instanciação técnica do princípio da separação na camada econômica: persistência de
              conteúdo é um bem público financiado por flows de criadores e operado pelo protocolo;
              serviços editoriais são bem privado vendido pela Aevia LLC por fee. Colapsar os dois
              destruiria tanto a Howey defense quanto o incentivo de Provider Nodes pra tratar Pool
              commitments como críveis.
            </p>
            <p>
              Toda compensação é denominada em cUSDC em Base L2. Não existe token nativo. Nenhuma
              tesouraria detém asset especulativo. Isso é deliberado: asset volátil distorceria
              orçamento de criador, economia operacional de Provider Node, e incentivos de
              governança do Conselho, e colapsaria a Howey defense que{' '}
              <span className="font-mono">/providers</span> e RFC-5 dependem.
            </p>
          </div>
        </section>

        <section id="s2-treasuries" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            4 tesourarias
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ol className="list-decimal pl-6 space-y-3 text-on-surface-variant">
              <li>
                <strong className="text-accent">PersistencePool</strong> — exclusivo do protocolo.
                Inflow: bootstrap LLC (one-way), Credit Pulse. Outflow: Provider Node payouts via
                settlement (RFC-5). LLC MUST NOT withdraw.
              </li>
              <li>
                <strong className="text-accent">LLCTreasury</strong> — Gnosis Safe 2-of-3, controle
                100% Aevia LLC. Inflow: relayer fees, aggregator fees, aevia.video take-rate, boost
                LLC share, enterprise. Outflow: folha, infra, operacional.
              </li>
              <li>
                <strong className="text-accent">CreatorEscrow</strong> — non-custodial intra-tx
                splitter. MUST NOT hold balance entre transações. Roteia tips/subs/boosts pro
                creator wallet + LLC take + pool fraction, tudo atômico.
              </li>
              <li>
                <strong className="text-accent">CouncilFund</strong> — Gnosis Safe council-only,
                ≥7-de-12 signers. Inflow: 1% de cada boost + bootstrap LLC. Outflow: stipends de
                conselheiros, auditorias, publicação do trust ledger. LLC MUST NOT withdraw.
              </li>
            </ol>
            <p>
              A matriz de transferência on-chain está em §3.6 — cada fluxo permitido enumerado;
              qualquer transferência fora da matriz é bright-line violation.
            </p>
          </div>
        </section>

        <section id="s3-boost" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            boost router
          </h2>
          <div className="mt-6 max-w-[72ch]">
            <p className="text-lg leading-[1.7] mb-4">
              Splitter contract não-custodial que recebe cUSDC pra amplificar um conteúdo específico
              e divide atomicamente em quatro recipients. É o principal Credit Pulse inflow pro Pool
              em steady state.
            </p>
            <p className="text-lg leading-[1.7] mb-4">
              <strong>Split default (governável pelo Conselho):</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant text-lg leading-[1.7] mb-6">
              <li>creator: 5 000 bps (50%)</li>
              <li>pool: 3 000 bps (30%)</li>
              <li>llc: 1 900 bps (19%)</li>
              <li>council: 100 bps (1%)</li>
            </ul>
            <p className="text-lg leading-[1.7] mb-4">
              <strong>Gate obrigatório (MUST):</strong> boost MUST revertar se R(c) ≥ θ_feed
              (RFC-6). Conteúdo que a AUP exclui do feed MUST NOT receber amplificação paga. Esse é
              o ponto de instanciação arquitetural da AUP na camada de amplificação.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-sm text-on-surface-variant mt-4">
              function boost(bytes32 manifestHash, uint256 amount) external;
            </pre>
          </div>
        </section>

        <section id="s4-invariants" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            invariantes (bright lines)
          </h2>
          <div className="mt-6 max-w-[72ch]">
            <p className="text-lg leading-[1.7] mb-4">
              12 invariantes MUST. Enforçados em contrato quando possível, em política de multisig
              quando não. Os mais críticos:
            </p>
            <ul className="list-none pl-0 space-y-3 text-on-surface-variant text-lg leading-[1.7]">
              <li>
                <strong className="text-accent">INV-1/2:</strong> LLC MUST NOT withdraw do
                Persistence Pool; bootstrap é one-way, sem clawback.
              </li>
              <li>
                <strong className="text-accent">INV-3/4:</strong> LLC MUST NOT withdraw do
                CouncilFund; parâmetros council-governable MUST NOT ser LLC-unilateral.
              </li>
              <li>
                <strong className="text-accent">INV-5/6:</strong> CreatorEscrow e BoostRouter MUST
                NOT hold balance entre transações.
              </li>
              <li>
                <strong className="text-accent">INV-7/8:</strong> tesourarias MUST holdar apenas
                cUSDC; protocolo MUST NOT emitir token nativo.
              </li>
              <li>
                <strong className="text-accent">INV-9:</strong> toda transferência MUST emitir
                evento auditável on-chain.
              </li>
              <li>
                <strong className="text-accent">INV-10:</strong> aggregator settlement MUST ter
                janela de contestação ≥72h antes de fundos serem claimable.
              </li>
              <li>
                <strong className="text-accent">INV-11:</strong> BoostRouter MUST gate em R(c) &lt;
                θ_feed.
              </li>
              <li>
                <strong className="text-accent">INV-12:</strong> R(c) ≥ θ_subsidy MUST NOT gerar
                Credit Pulse inflow pro Pool.
              </li>
            </ul>
          </div>
        </section>

        <section id="s5-canonical" className="py-12">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8 max-w-[72ch]">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">
              fonte canônica
            </span>
            <p className="mt-3 text-base leading-[1.7] text-on-surface-variant">
              Esta página renderiza um resumo do RFC-8. O texto normativo completo (1043 linhas com
              BoostRouter Solidity interface completa, matriz de transferência detalhada, todos os 6
              operator fees enumerados, security considerations cobrindo aggregator capture / boost
              spam / governance capture / Howey reinterpretation / take-rate races, implementation
              reference com event signatures + bootstrap sequence) está em:
            </p>
            <a
              href={CANONICAL_URL}
              className="mt-4 inline-flex items-center gap-2 font-mono text-sm text-primary hover:text-primary-dim"
            >
              docs/protocol-spec/8-economic-architecture.md →
            </a>
          </div>
        </section>
      </>
    );
  },
};
