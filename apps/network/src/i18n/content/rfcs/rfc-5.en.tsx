import type { RFCContent } from './types';

export const rfc5En: RFCContent = {
  toc: [
    { id: 's1-escopo', label: '§1 · scope' },
    { id: 's2-contrato', label: '§2 · contract interface' },
    { id: 's3-challenge', label: '§3 · challenge-response protocol' },
    { id: 's4-formula', label: '§4 · compensation formula' },
    { id: 's5-pesos-regiao', label: '§5 · region weights' },
    { id: 's6-epochs', label: '§6 · epochs and disbursement' },
    { id: 's7-seguranca', label: '§7 · security considerations' },
    { id: 's8-referencias', label: '§8 · references' },
  ],
  Body() {
    return (
      <>
        <section id="s1-escopo" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§1</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            scope
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              This document defines the Persistence Pool: a Solidity contract on Base that holds
              cUSDC and compensates provider nodes for audited replication. It specifies the
              contract interface, the challenge-response protocol, the compensation formula, and the
              parameters governable via Council (RFC-7). Provider nodes MUST implement valid
              responses to challenges per §3 to be eligible for payment.
            </p>
            <p>MUST, SHOULD, MAY follow RFC 2119.</p>
          </div>
        </section>

        <section id="s2-contrato" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            contract interface
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>The canonical Persistence Pool interface includes, at a minimum:</p>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-surface-lowest p-6 font-mono text-sm text-on-surface-variant max-w-[72ch]">
            <code>{`interface IPersistencePool {
  // A provider node registers with region and replication intent.
  function register(uint8 region) external;

  // The contract emits a byte-range challenge for a CID under custody.
  event Challenge(
    bytes32 indexed challengeId,
    address indexed provider,
    bytes32 cidHash,
    uint64 rangeStart,
    uint64 rangeEnd,
    uint64 deadlineBlock
  );

  // Provider responds with the requested bytes + Merkle proof.
  function respond(
    bytes32 challengeId,
    bytes calldata rangeBytes,
    bytes32[] calldata merkleProof
  ) external;

  // Epoch closes, disbursement computed off-chain, submitted in batch.
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
              Reference implementations live in{' '}
              <span className="font-mono">packages/contracts/src/PersistencePool.sol</span>. The
              canonical address on Base Sepolia is published in the network footer.
            </p>
          </div>
        </section>

        <section id="s3-challenge" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            challenge-response protocol
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              At random intervals (Poisson with rate <span className="font-mono">λ</span> per node
              per epoch), the contract emits a challenge consisting of:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono">challengeId</span> — unique identifier;
              </li>
              <li>
                <span className="font-mono">cidHash</span> — hash of the target CID under the
                provider’s custody;
              </li>
              <li>
                <span className="font-mono">[rangeStart, rangeEnd]</span> — random byte range within
                the object;
              </li>
              <li>
                <span className="font-mono">deadlineBlock</span> — block number by which the
                response must be submitted.
              </li>
            </ul>
            <p>Provider nodes MUST, within the deadline:</p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant">
              <li>
                read the bytes <span className="font-mono">O[rangeStart..rangeEnd]</span> from
                locally stored data;
              </li>
              <li>
                compute the Merkle proof of the range against the pre-computed root for the CID (64
                KiB chunk tree);
              </li>
              <li>
                submit via <span className="font-mono">respond()</span> the bytes and the proof.
              </li>
            </ol>
            <p>
              The contract verifies the proof; a valid response increments{' '}
              <span className="font-mono">R_i</span> for the provider. A missing or invalid response
              decrements it. The deadline window SHOULD be short enough (typically ≤ 2 minutes) to
              defeat inter-peer fetch at challenge time.
            </p>
          </div>
        </section>

        <section id="s4-formula" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            compensation formula
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              The compensation of a provider node in epoch <span className="font-mono">t</span> is:
            </p>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent max-w-[72ch]">
            P_i(t) = R_i(t) · B_i(t) · W_region(i) · ρ(t)
          </pre>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono text-primary">R_i(t)</span> ∈ [0,1] — fraction of
                challenges correctly answered in the epoch.
              </li>
              <li>
                <span className="font-mono text-primary">B_i(t)</span> — byte-hours of audited
                replicated content (sum of object sizes under custody × epoch hours).
              </li>
              <li>
                <span className="font-mono text-primary">W_region(i)</span> ∈ {'{'}0.5, 1.0, 1.5
                {'}'} — regional weight (§5).
              </li>
              <li>
                <span className="font-mono text-primary">ρ(t)</span> — pool unit rate for the epoch:{' '}
                <span className="font-mono">ε · S(t) / Σ_i (R_i · B_i · W_region)</span>, where{' '}
                <span className="font-mono">S(t)</span> is the pool balance and{' '}
                <span className="font-mono">ε</span> is the per-epoch disbursement fraction.
              </li>
            </ul>
            <p>
              By construction, <span className="font-mono">Σ_i P_i(t) = ε · S(t)</span>. The
              contract MUST reject settlements that violate this conservation.
            </p>
          </div>
        </section>

        <section id="s5-pesos-regiao" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            region weights
          </h2>
          <div className="mt-6 text-lg leading-[1.7] max-w-[72ch]">
            <p className="mb-4 text-on-surface-variant">
              Regional weights encode geographic scarcity of custody. Initial values:
            </p>
            <table className="w-full border-collapse font-mono text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    region
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    weight
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 text-xs tracking-[0.04em] text-tertiary">
                    rationale
                  </th>
                </tr>
              </thead>
              <tbody className="text-on-surface-variant">
                <tr className="border-b border-primary-dim/20">
                  <td className="py-3 pr-6 text-primary">0 (default)</td>
                  <td className="py-3 pr-6">1.0</td>
                  <td className="py-3">global north — baseline</td>
                </tr>
                <tr className="border-b border-primary-dim/20">
                  <td className="py-3 pr-6 text-primary">1 (low scarcity)</td>
                  <td className="py-3 pr-6">0.5</td>
                  <td className="py-3">regions with &gt;30% of nodes — weighted less</td>
                </tr>
                <tr className="border-b border-primary-dim/20">
                  <td className="py-3 pr-6 text-primary">2 (high scarcity)</td>
                  <td className="py-3 pr-6">1.5</td>
                  <td className="py-3">global south, central asia, africa — weighted more</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-on-surface-variant">
              Regional classification is re-evaluated every 6 epochs by the Council, based on a
              public node distribution map. Changes MUST be announced on the Trust Ledger with ≥ 14
              days of notice.
            </p>
          </div>
        </section>

        <section id="s6-epochs" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            epochs and disbursement
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                default epoch duration: <span className="font-mono">168 hours (7 days)</span>.
              </li>
              <li>
                default disbursement fraction <span className="font-mono">ε</span>:{' '}
                <span className="font-mono">0.10</span> (10% of balance per epoch).
              </li>
              <li>
                default challenge rate <span className="font-mono">λ</span>:{' '}
                <span className="font-mono">100</span> challenges per node per epoch — sufficient
                for a dishonest provider’s survival probability to be{' '}
                <span className="font-mono">(1 − p)^λ ≈ 10^-100</span> for{' '}
                <span className="font-mono">p = 0.9</span>.
              </li>
              <li>
                settlement is computed off-chain by a trusted aggregator (currently Aevia LLC),
                producing a Merkle root of <span className="font-mono">(provider → amount)</span>
                {'; '}the contract verifies conservation and executes payments.
              </li>
            </ul>
            <p>
              Parameters <span className="font-mono">ε</span>, <span className="font-mono">λ</span>,
              and epoch duration are governable via Council (RFC-7) with a veto process.
            </p>
          </div>
        </section>

        <section id="s7-seguranca" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            security considerations
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                dishonest provider: defeated by the combination of random byte-range + short
                deadline (§3). Survival probability made explicit in §10(a) of the whitepaper.
              </li>
              <li>
                Sybil: neutralized because payment is proportional to{' '}
                <span className="font-mono">B_i</span> actually replicated, not node count.
              </li>
              <li>
                aggregator capture: a malicious aggregator could submit wrong settlements.
                Mitigation: settlements MUST have an on-chain contestation window (e.g., 72h after
                submission) during which any provider can submit a counter-proof. Migration to
                decentralized aggregation is in RFC-7 scope.
              </li>
              <li>
                economic attack via B dumping: a large actor could inflate{' '}
                <span className="font-mono">B</span>, depressing{' '}
                <span className="font-mono">ρ</span> for small operators. The Council MAY propose a
                contract fork excluding the actor.
              </li>
            </ul>
          </div>
        </section>

        <section id="s8-referencias" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§8</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            references
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
