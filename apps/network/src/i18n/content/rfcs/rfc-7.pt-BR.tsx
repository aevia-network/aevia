import type { RFCContent } from './types';

const CANONICAL_URL =
  'https://github.com/aevia-network/aevia/blob/main/docs/protocol-spec/7-moderation-jury.md';

export const rfc7PtBR: RFCContent = {
  toc: [
    { id: 's1-abstract', label: 'abstract' },
    { id: 's2-composition', label: '§3 · composição do conselho' },
    { id: 's3-governance', label: '§4 · governance de parâmetros' },
    { id: 's4-trust-ledger', label: '§6 · trust ledger' },
    { id: 's5-canonical', label: 'canônico em docs/' },
  ],
  Body() {
    return (
      <>
        <section id="s1-abstract" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">abstract</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            Moderação e Conselho Ecumênico
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Especifica o <strong>Conselho Ecumênico</strong> e o procedimento de{' '}
              <strong>Jury</strong> pelo qual as decisões de camada de distribuição da Aevia são
              governadas. O Conselho é um órgão de doze assentos com mandatos de quatro anos que
              detém autoridade de veto sobre parâmetros do protocolo afetando persistência,
              distribuição e pool. O Jury é o subconjunto de membros do Conselho que revisa Risk
              Scores contestados e disputas ao nível de conteúdo em regime rolante.
            </p>
            <p>
              O Conselho existe para resolver uma tensão estrutural. Governança token-weighted
              converge pra plutocracia em escala. Governança democrática pessoa-por-pessoa é
              vulnerável a Sybil na camada de identidade do protocolo. Aevia escolhe deliberadamente
              nenhuma das duas. O Conselho é um órgão plural de tamanho fixo: doze indivíduos com
              perspectivas teológicas, filosóficas e profissionais publicamente declaradas, nenhuma
              tradição única detendo maioria, cada um com um veto one-time-per-term em propostas de
              parâmetro que julguem incompatíveis com os valores declarados do protocolo.
            </p>
            <p>
              Cada deliberação, voto, veto e opinião divergente é publicada no{' '}
              <strong>Trust Ledger</strong>, um log Merkle-anchored em Base L2. Qualquer parte —
              criador, Provider Node, Operador, regulador, jornalista — pode auditar o histórico de
              moderação do protocolo a partir dele.
            </p>
          </div>
        </section>

        <section id="s2-composition" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            composição do conselho
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>exatamente 12 assentos, mandatos de 4 anos, rotação escalonada</li>
              <li>
                constraint de pluralidade (MUST): nenhuma tradição declarada única pode ocupar mais
                de 4 dos 12 assentos
              </li>
              <li>
                traditions reconhecidas (v0.1): eastern orthodox, católico romano, reformado,
                evangélico não-reformado, pentecostal/carismático, judaico, muçulmano, outras
                monoteístas, secular/não-afiliado, outros (budista, hindu, tradições indígenas)
              </li>
              <li>assentos ocupados por indivíduos reais, não organizações ou DAOs</li>
              <li>recusal obrigatório em conflito de interesse material</li>
              <li>
                removal-for-cause por ≥9/12 (supermaioria) — sem veto aplicável; causas: fraude,
                violação pública da AUP, inatividade sustentada, condenação por crime protocol-
                related
              </li>
            </ul>
          </div>
        </section>

        <section id="s3-governance" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            governance de parâmetros
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>Workflow canônico (MUST) pra toda mudança de parâmetro council-governable:</p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant">
              <li>submissão da proposta com justificativa ≥500 palavras no Trust Ledger</li>
              <li>
                <strong>21 dias</strong> de comment period aberto (qualquer DID pode comentar)
              </li>
              <li>
                <strong>14 dias</strong> de votação (≥7/12 majoria simples; ≥9/12 pra mudanças em
                governance rules)
              </li>
              <li>
                48h pra qualquer membro exercer <strong>veto per-term</strong> (um por mandato) com
                justificativa ≥500 palavras
              </li>
              <li>
                implementação pelo Operador em 7 dias (parâmetros) ou 30 dias (deploy de contrato),
                com transition period quando aplicável
              </li>
            </ol>
            <p>
              <strong>Não council-governable:</strong> absolute exclusions AUP [b] e [c],
              invariantes RFC 8 §7, regras de composição do próprio Conselho (exceto ≥9/12 + 90 dias
              comment), proibição de token nativo (RFC 8 INV-8).
            </p>
          </div>
        </section>

        <section id="s4-trust-ledger" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            trust ledger
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Log append-only de eventos de governança, signado por DID, com Merkle root anchored em
              Base L2 via <span className="font-mono">LedgerAnchor.sol</span> em cadência por epoch
              (default semanal). Descobrível via:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono">aevia.network/transparency</span> — human-readable
              </li>
              <li>
                API REST/gRPC pública em{' '}
                <span className="font-mono">trust-ledger.aevia.network</span>
              </li>
              <li>consulta direta da Merkle tree via contrato LedgerAnchor</li>
            </ul>
            <p>
              Tipos de evento: council_induction, parameter_proposal, parameter_vote,
              parameter_veto, jury_convened, jury_decision, jury_dissent, risk_score, risk_contest,
              election_result, etc. Cada evento é signature-verifiable offline a partir da canonical
              JSON (RFC 8785) e public key do signer.
            </p>
          </div>
        </section>

        <section id="s5-canonical" className="py-12">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8 max-w-[72ch]">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">
              fonte canônica
            </span>
            <p className="mt-3 text-base leading-[1.7] text-on-surface-variant">
              Esta página renderiza um resumo do RFC-7. O texto normativo completo (911 linhas com
              linguagem RFC 2119, procedimento completo de Jury, estrutura de compensação do Council
              Fund, bootstrap e rotação, eleições pós-bootstrap com ranked-choice voting, security
              considerations cobrindo council capture / Jury bribery / pseudonymous attack) está em:
            </p>
            <a
              href={CANONICAL_URL}
              className="mt-4 inline-flex items-center gap-2 font-mono text-sm text-primary hover:text-primary-dim"
            >
              docs/protocol-spec/7-moderation-jury.md →
            </a>
          </div>
        </section>
      </>
    );
  },
};
