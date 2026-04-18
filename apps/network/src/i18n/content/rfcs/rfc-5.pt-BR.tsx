import type { RFCContent } from './types';

export const rfc5PtBR: RFCContent = {
  toc: [
    { id: 's1-escopo', label: '§1 · escopo' },
    { id: 's2-contrato', label: '§2 · interface do contrato' },
    { id: 's3-challenge', label: '§3 · protocolo challenge-response' },
    { id: 's4-formula', label: '§4 · fórmula de compensação' },
    { id: 's5-pesos-regiao', label: '§5 · pesos de região' },
    { id: 's6-epochs', label: '§6 · epochs e disbursement' },
    { id: 's7-seguranca', label: '§7 · considerações de segurança' },
    { id: 's8-referencias', label: '§8 · referências' },
  ],
  Body() {
    return (
      <>
        <section id="s1-escopo" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§1</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            escopo
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Este documento define o Persistence Pool: contrato Solidity em Base que custodia cUSDC
              e compensa provider nodes por replicação auditada. Especifica a interface do contrato,
              o protocolo de challenge-response, a fórmula de compensação e os parâmetros
              governáveis via Conselho (RFC-7). Provider nodes MUST implementar respostas válidas a
              challenges conforme §3 para serem elegíveis a pagamento.
            </p>
            <p>MUST, SHOULD, MAY seguem RFC 2119.</p>
          </div>
        </section>

        <section id="s2-contrato" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            interface do contrato
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>A interface canônica do Persistence Pool inclui, no mínimo:</p>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-surface-lowest p-6 font-mono text-sm text-on-surface-variant max-w-[72ch]">
            <code>{`interface IPersistencePool {
  // Um provider node se registra com região e intenção de replicar.
  function register(uint8 region) external;

  // O contrato emite um desafio de byte-range para um CID sob custódia.
  event Challenge(
    bytes32 indexed challengeId,
    address indexed provider,
    bytes32 cidHash,
    uint64 rangeStart,
    uint64 rangeEnd,
    uint64 deadlineBlock
  );

  // Provider responde com os bytes solicitados + prova Merkle.
  function respond(
    bytes32 challengeId,
    bytes calldata rangeBytes,
    bytes32[] calldata merkleProof
  ) external;

  // Epoch fecha e disbursement é computado off-chain, submetido em batch.
  function submitSettlement(
    uint64 epoch,
    bytes32 merkleRoot,
    address[] calldata providers,
    uint256[] calldata amounts
  ) external;
}`}</code>
          </pre>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Implementações de referência estão em{' '}
              <span className="font-mono">packages/contracts/src/PersistencePool.sol</span>. O
              endereço canônico em Base Sepolia é publicado no footer da network.
            </p>
          </div>
        </section>

        <section id="s3-challenge" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            protocolo challenge-response
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Em intervalos aleatórios (Poisson com taxa <span className="font-mono">λ</span> por nó
              por epoch), o contrato emite um challenge consistindo de:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono">challengeId</span> — identificador único;
              </li>
              <li>
                <span className="font-mono">cidHash</span> — hash do CID alvo sob custódia do
                provider;
              </li>
              <li>
                <span className="font-mono">[rangeStart, rangeEnd]</span> — byte-range aleatório
                dentro do objeto;
              </li>
              <li>
                <span className="font-mono">deadlineBlock</span> — número de bloco até o qual a
                resposta deve ser submetida.
              </li>
            </ul>
            <p>Provider nodes MUST, dentro do deadline:</p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant">
              <li>
                ler os bytes <span className="font-mono">O[rangeStart..rangeEnd]</span> dos dados
                armazenados localmente;
              </li>
              <li>
                computar o Merkle proof do range contra a raiz pré-calculada do CID (árvore de
                chunks de 64 KiB);
              </li>
              <li>
                submeter via <span className="font-mono">respond()</span> os bytes e a prova.
              </li>
            </ol>
            <p>
              O contrato verifica a prova; resposta válida incrementa{' '}
              <span className="font-mono">R_i</span> do provider. Resposta ausente ou inválida a
              decrementa. A janela de deadline SHOULD ser curta o suficiente (tipicamente ≤ 2
              minutos) para derrotar fetch inter-peer no momento do challenge.
            </p>
          </div>
        </section>

        <section id="s4-formula" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            fórmula de compensação
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              A compensação de um provider node na epoch <span className="font-mono">t</span> é:
            </p>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent max-w-[72ch]">
            P_i(t) = R_i(t) · B_i(t) · W_region(i) · ρ(t)
          </pre>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono text-primary">R_i(t)</span> ∈ [0,1] — fração de
                challenges respondidos corretamente na epoch.
              </li>
              <li>
                <span className="font-mono text-primary">B_i(t)</span> — byte-horas de conteúdo
                replicado auditado (soma do tamanho dos objetos sob custódia × horas da epoch).
              </li>
              <li>
                <span className="font-mono text-primary">W_region(i)</span> ∈ {'{'}0.5, 1.0, 1.5
                {'}'} — peso regional (§5).
              </li>
              <li>
                <span className="font-mono text-primary">ρ(t)</span> — taxa unitária do pool na
                epoch: <span className="font-mono">ε · S(t) / Σ_i (R_i · B_i · W_region)</span>,
                onde <span className="font-mono">S(t)</span> é o saldo do pool e{' '}
                <span className="font-mono">ε</span> a fração de desembolso por epoch.
              </li>
            </ul>
            <p>
              Por construção, <span className="font-mono">Σ_i P_i(t) = ε · S(t)</span>. O contrato
              MUST recusar settlements que violem essa conservação.
            </p>
          </div>
        </section>

        <section id="s5-pesos-regiao" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            pesos de região
          </h2>
          <div className="mt-6 text-lg leading-[1.7] max-w-[72ch]">
            <p className="mb-4 text-on-surface-variant">
              Pesos regionais codificam escassez geográfica de custódia. Valores iniciais:
            </p>
            <table className="w-full border-collapse font-mono text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    região
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    peso
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 text-xs tracking-[0.04em] text-tertiary">
                    racional
                  </th>
                </tr>
              </thead>
              <tbody className="text-on-surface-variant">
                <tr className="border-b border-primary-dim/20">
                  <td className="py-3 pr-6 text-primary">0 (padrão)</td>
                  <td className="py-3 pr-6">1.0</td>
                  <td className="py-3">norte global — baseline</td>
                </tr>
                <tr className="border-b border-primary-dim/20">
                  <td className="py-3 pr-6 text-primary">1 (baixa escassez)</td>
                  <td className="py-3 pr-6">0.5</td>
                  <td className="py-3">regiões com &gt;30% dos nós — pondera-se menos</td>
                </tr>
                <tr className="border-b border-primary-dim/20">
                  <td className="py-3 pr-6 text-primary">2 (alta escassez)</td>
                  <td className="py-3 pr-6">1.5</td>
                  <td className="py-3">sul global, ásia central, áfrica — pondera-se mais</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-on-surface-variant">
              A classificação regional é reavaliada a cada 6 epochs pelo Conselho, com base em mapa
              de distribuição pública de nós. Mudanças MUST ser anunciadas no Trust Ledger com ≥ 14
              dias de antecedência.
            </p>
          </div>
        </section>

        <section id="s6-epochs" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            epochs e disbursement
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                duração de epoch padrão: <span className="font-mono">168 horas (7 dias)</span>.
              </li>
              <li>
                fração de disbursement <span className="font-mono">ε</span> padrão:{' '}
                <span className="font-mono">0.10</span> (10% do saldo por epoch).
              </li>
              <li>
                taxa de challenge <span className="font-mono">λ</span> padrão:{' '}
                <span className="font-mono">100</span> challenges por nó por epoch — suficiente para
                que a probabilidade de um provider desonesto sobreviver uma epoch seja{' '}
                <span className="font-mono">(1 − p)^λ ≈ 10^-100</span> para{' '}
                <span className="font-mono">p = 0.9</span>.
              </li>
              <li>
                o settlement é computado off-chain por um agregador confiável (atualmente Aevia
                LLC), produzindo uma Merkle root de{' '}
                <span className="font-mono">(provider → amount)</span>; o contrato verifica a
                conservação e executa os pagamentos.
              </li>
            </ul>
            <p>
              Parâmetros <span className="font-mono">ε</span>, <span className="font-mono">λ</span>,
              e duração de epoch são governáveis via Conselho (RFC-7) com processo de veto.
            </p>
          </div>
        </section>

        <section id="s7-seguranca" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            considerações de segurança
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                provider desonesto: derrotado pela combinação de random byte-range + deadline curto
                (§3). Probabilidade de sobrevivência explicitada em §10(a) do whitepaper.
              </li>
              <li>
                Sybil: neutralizado porque pagamento é proporcional a{' '}
                <span className="font-mono">B_i</span> efetivamente replicado, não à contagem de
                nós.
              </li>
              <li>
                captura do agregador: uma agregadora maliciosa pode submeter settlements errados.
                Mitigação: settlements MUST ter prazo de contestação on-chain (ex: 72h após
                submissão) durante o qual qualquer provider pode submeter contra-prova. A migração
                para agregação descentralizada está em escopo do RFC-7.
              </li>
              <li>
                ataque econômico via dumping de B: um ator grande poderia inflar{' '}
                <span className="font-mono">B</span> deprimindo <span className="font-mono">ρ</span>{' '}
                para operadores pequenos. Conselho pode propor fork do contrato excluindo o ator.
              </li>
            </ul>
          </div>
        </section>

        <section id="s8-referencias" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§8</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            referências
          </h2>
          <div className="mt-6 max-w-[72ch]">
            <ol className="list-decimal pl-6 font-mono text-sm text-on-surface-variant space-y-2">
              <li>IETF RFC 2119 — Key words for RFCs</li>
              <li>Aevia Whitepaper §5, §10, §12</li>
              <li>RFC-2 — Content Addressing</li>
              <li>RFC-6 — Risk Score (draft)</li>
              <li>RFC-7 — Moderation and Ecumenical Jury (draft)</li>
              <li>cUSDC on Base — Circle documentation</li>
              <li>PersistencePool.sol — reference implementation</li>
            </ol>
          </div>
        </section>
      </>
    );
  },
};
