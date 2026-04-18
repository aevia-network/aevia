import type { RFCContent } from './types';

const CANONICAL_URL =
  'https://github.com/aevia-network/aevia/blob/main/docs/protocol-spec/8-economic-architecture.md';

export const rfc8En: RFCContent = {
  toc: [
    { id: 's1-abstract', label: 'abstract' },
    { id: 's2-treasuries', label: '§3 · 4 treasuries' },
    { id: 's3-boost', label: '§4 · boost router' },
    { id: 's4-invariants', label: '§7 · invariants' },
    { id: 's5-canonical', label: 'canonical in docs/' },
  ],
  Body() {
    return (
      <>
        <section id="s1-abstract" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">abstract</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            Economic Architecture
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Specifies the <strong>economic architecture</strong> of the Aevia protocol: which
              treasuries hold cUSDC, who controls each, how funds move between them, and which
              invariants MUST hold at all times. It is the third leg of the three-document stool
              that grounds the protocol&apos;s <em>not-a-securities-offering</em> posture; the other
              two are RFC-4 (AUP) and RFC-5 (Persistence Pool).
            </p>
            <p>
              The core design commitment is that the Persistence Pool is{' '}
              <strong>non-discretionary</strong>. Aevia LLC pre-funds it during bootstrap and
              thereafter has no claim on the balance; disbursements are programmatic per RFC-5. This
              is the technical instantiation of the separation principle at the economic layer:
              content persistence is a public good funded by creator flows and operated by the
              protocol; editorial services are a private good sold by Aevia LLC for a fee.
              Collapsing these two would destroy both the Howey defense and Provider Nodes&apos;
              incentive to treat Pool commitments as credible.
            </p>
            <p>
              All compensation is denominated in cUSDC on Base L2. No native token exists. No
              treasury holds speculative assets. This is deliberate: a volatile settlement asset
              would distort creator budgeting, Provider Node operating economics, and Council
              governance incentives, and would collapse the Howey defense that{' '}
              <span className="font-mono">/providers</span> and RFC-5 rely on.
            </p>
          </div>
        </section>

        <section id="s2-treasuries" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            4 treasuries
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ol className="list-decimal pl-6 space-y-3 text-on-surface-variant">
              <li>
                <strong className="text-accent">PersistencePool</strong> — protocol-exclusive.
                Inflow: LLC bootstrap (one-way), Credit Pulse. Outflow: Provider Node payouts via
                settlement (RFC-5). LLC MUST NOT withdraw.
              </li>
              <li>
                <strong className="text-accent">LLCTreasury</strong> — Gnosis Safe 2-of-3, 100%
                Aevia LLC-controlled. Inflow: relayer fees, aggregator fees, aevia.video take-rate,
                boost LLC share, enterprise. Outflow: payroll, infra, operations.
              </li>
              <li>
                <strong className="text-accent">CreatorEscrow</strong> — non-custodial intra-tx
                splitter. MUST NOT hold balance between transactions. Routes tips/subs/boosts to
                creator wallet + LLC take + pool fraction, all atomic.
              </li>
              <li>
                <strong className="text-accent">CouncilFund</strong> — Gnosis Safe council-only,
                ≥7-of-12 signers. Inflow: 1% of every boost + LLC bootstrap. Outflow: council
                stipends, audits, trust-ledger publication. LLC MUST NOT withdraw.
              </li>
            </ol>
            <p>
              The on-chain transfer matrix is in §3.6 — every permitted flow enumerated; any
              transfer not in the matrix is a bright-line violation.
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
              Non-custodial splitter contract that receives cUSDC to amplify a specific content item
              and divides atomically across four recipients. It is the primary Credit Pulse inflow
              to the Pool at steady state.
            </p>
            <p className="text-lg leading-[1.7] mb-4">
              <strong>Default split (Council-governable):</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant text-lg leading-[1.7] mb-6">
              <li>creator: 5 000 bps (50%)</li>
              <li>pool: 3 000 bps (30%)</li>
              <li>llc: 1 900 bps (19%)</li>
              <li>council: 100 bps (1%)</li>
            </ul>
            <p className="text-lg leading-[1.7] mb-4">
              <strong>Mandatory gate (MUST):</strong> a boost MUST revert if R(c) ≥ θ_feed (RFC-6).
              Content excluded by the AUP from the feed MUST NOT receive paid amplification. This is
              the architectural instantiation of the AUP at the amplification layer.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-sm text-on-surface-variant mt-4">
              function boost(bytes32 manifestHash, uint256 amount) external;
            </pre>
          </div>
        </section>

        <section id="s4-invariants" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            invariants (bright lines)
          </h2>
          <div className="mt-6 max-w-[72ch]">
            <p className="text-lg leading-[1.7] mb-4">
              12 MUST invariants. Enforced in contract where possible, in multisig policy where not.
              The most critical:
            </p>
            <ul className="list-none pl-0 space-y-3 text-on-surface-variant text-lg leading-[1.7]">
              <li>
                <strong className="text-accent">INV-1/2:</strong> LLC MUST NOT withdraw from
                Persistence Pool; bootstrap is one-way with no clawback.
              </li>
              <li>
                <strong className="text-accent">INV-3/4:</strong> LLC MUST NOT withdraw from
                CouncilFund; council-governable parameters MUST NOT be LLC-unilateral.
              </li>
              <li>
                <strong className="text-accent">INV-5/6:</strong> CreatorEscrow and BoostRouter MUST
                NOT hold balance between transactions.
              </li>
              <li>
                <strong className="text-accent">INV-7/8:</strong> treasuries MUST hold only cUSDC;
                protocol MUST NOT issue a native token.
              </li>
              <li>
                <strong className="text-accent">INV-9:</strong> every transfer MUST emit an on-chain
                auditable event.
              </li>
              <li>
                <strong className="text-accent">INV-10:</strong> aggregator settlement MUST have
                ≥72h contestation window before funds become claimable.
              </li>
              <li>
                <strong className="text-accent">INV-11:</strong> BoostRouter MUST gate on R(c) &lt;
                θ_feed.
              </li>
              <li>
                <strong className="text-accent">INV-12:</strong> R(c) ≥ θ_subsidy MUST NOT generate
                Credit Pulse inflow to the Pool.
              </li>
            </ul>
          </div>
        </section>

        <section id="s5-canonical" className="py-12">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8 max-w-[72ch]">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">
              canonical source
            </span>
            <p className="mt-3 text-base leading-[1.7] text-on-surface-variant">
              This page renders a summary of RFC-8. The full normative text (1043 lines with
              complete BoostRouter Solidity interface, detailed transfer matrix, all 6 operator fees
              enumerated, security considerations covering aggregator capture / boost spam /
              governance capture / Howey reinterpretation / take-rate races, implementation
              reference with event signatures + bootstrap sequence) is at:
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
