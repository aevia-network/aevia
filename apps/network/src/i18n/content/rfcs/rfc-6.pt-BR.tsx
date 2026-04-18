import type { RFCContent } from './types';

const CANONICAL_URL =
  'https://github.com/aevia-network/aevia/blob/main/docs/protocol-spec/6-risk-score.md';

export const rfc6PtBR: RFCContent = {
  toc: [
    { id: 's1-abstract', label: 'abstract' },
    { id: 's2-formula', label: '§3 · fórmula' },
    { id: 's3-thresholds', label: '§7 · thresholds' },
    { id: 's4-canonical', label: 'canônico em docs/' },
  ],
  Body() {
    return (
      <>
        <section id="s1-abstract" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">abstract</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            Risk Score
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Este documento especifica o <strong>Risk Score</strong>, a função pública R(c) ∈ [0,
              1] que governa quais conteúdos são elegíveis a subsídio do Persistence Pool, placement
              em feeds e rankings operados pela Aevia, e amplificação via Boost Router. O Score é
              computado off-chain a partir de inputs públicos, assinado, e publicado em um contrato
              oracle on-chain que consumidores (em particular o Boost Router, por RFC 8 §4.4) lêem
              in-transaction.
            </p>
            <p>
              O Risk Score é o mecanismo técnico pelo qual o critério editorial declarado em RFC 4
              (a Acceptable Use Policy) é enforçado na camada de distribuição{' '}
              <em>sem prejudicar a camada de persistência</em>. Conteúdo com R(c) alto perde
              subsídio e feed placement; não se torna inacessível. Essa assimetria é a instanciação
              arquitetural do princípio persistência-não-é-distribuição na esfera editorial, e é o
              que preserva a postura de intermediário sob Section 230 (RFC 4 §2).
            </p>
          </div>
        </section>

        <section id="s2-formula" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            fórmula
          </h2>
          <div className="mt-6 max-w-[72ch]">
            <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent">
              R(c, t) = α · R_legal(c, t) + β · R_abuse(c, t) + γ · R_values(c, t)
            </pre>
            <ul className="mt-6 list-disc pl-6 space-y-2 text-on-surface-variant text-lg leading-[1.7]">
              <li>
                default (α, β, γ) = (0.4, 0.3, 0.3); soma MUST ser 1.0 — qualquer proposta que viole
                isso MUST ser rejeitada
              </li>
              <li>
                <span className="font-mono text-primary">R_legal</span> — signals de DMCA / DSA /
                subpoena / OFAC com pesos por classe
              </li>
              <li>
                <span className="font-mono text-primary">R_abuse</span> — flags de usuários
                ponderadas por reputação do reporter e normalizadas por audiência
              </li>
              <li>
                <span className="font-mono text-primary">R_values</span> — output do classifier por
                categoria AUP combinado com pesos de severidade s_k
              </li>
              <li>
                categorias absolute exclusion ([b] e [c] da AUP) forçam R_values = 1.0
                independentemente do classifier
              </li>
            </ul>
          </div>
        </section>

        <section id="s3-thresholds" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            thresholds e enforcement
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-none pl-0 space-y-3 text-on-surface-variant">
              <li>
                <span className="font-mono text-primary">θ_subsidy = 0.5</span> — R(c) acima disso
                exclui do subsídio do Persistence Pool (RFC 5 §7)
              </li>
              <li>
                <span className="font-mono text-primary">θ_feed = 0.3</span> — R(c) acima disso
                exclui do feed curado, do ranking, e do Boost Router (RFC 8 §4.4)
              </li>
              <li>
                <span className="font-mono text-primary">θ_review = 0.4</span> — trigger de
                escalação pra Jury (RFC 7)
              </li>
            </ul>
            <p>
              <strong>Enforcement não é remoção.</strong> Nenhuma das ações acima remove os bytes do
              conteúdo da rede. O CID continua resolvível; qualquer Provider Node que escolha
              continuar hospedando pode fazer isso ao próprio custo; clientes alternativos podem
              renderizar o conteúdo sob seu próprio critério editorial. Essa é a destilação do
              princípio persistência-não-é-distribuição na fronteira R(c).
            </p>
          </div>
        </section>

        <section id="s4-canonical" className="py-12">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8 max-w-[72ch]">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">
              fonte canônica
            </span>
            <p className="mt-3 text-base leading-[1.7] text-on-surface-variant">
              Esta página renderiza um resumo do RFC-6. O texto normativo completo (912 linhas com
              linguagem RFC 2119 MUST/SHOULD/MAY, interfaces Solidity do RiskOracle, regras de due
              process DMCA/DSA, matriz de reputação de reporter, workflow completo de apelação via
              Jury, security considerations) está em:
            </p>
            <a
              href={CANONICAL_URL}
              className="mt-4 inline-flex items-center gap-2 font-mono text-sm text-primary hover:text-primary-dim"
            >
              docs/protocol-spec/6-risk-score.md →
            </a>
          </div>
        </section>
      </>
    );
  },
};
