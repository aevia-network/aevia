import type { RFCContent } from './types';

const CANONICAL_URL =
  'https://github.com/aevia-network/aevia/blob/main/docs/protocol-spec/6-risk-score.md';

export const rfc6En: RFCContent = {
  toc: [
    { id: 's1-abstract', label: 'abstract' },
    { id: 's2-formula', label: '§3 · formula' },
    { id: 's3-thresholds', label: '§7 · thresholds' },
    { id: 's4-canonical', label: 'canonical in docs/' },
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
              This document specifies the <strong>Risk Score</strong>, the public function R(c) ∈
              [0, 1] that governs which content is eligible for Persistence Pool subsidy, for
              placement in Aevia-operated feeds and rankings, and for amplification via the Boost
              Router. The Score is computed off-chain from public inputs, signed, and published to
              an on-chain oracle contract that consumers (notably the Boost Router, per RFC 8 §4.4)
              read in-transaction.
            </p>
            <p>
              The Risk Score is the technical mechanism by which the editorial criterion declared in
              RFC 4 (the AUP) is enforced at the distribution layer{' '}
              <em>without impairing the persistence layer</em>. Content with high R(c) loses subsidy
              and feed placement; it does not become inaccessible. This asymmetry is the
              architectural instantiation of the persistence-is-not-distribution principle at the
              editorial tier, and it is what preserves the protocol&apos;s Section 230 intermediary
              posture (RFC 4 §2).
            </p>
          </div>
        </section>

        <section id="s2-formula" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            formula
          </h2>
          <div className="mt-6 max-w-[72ch]">
            <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent">
              R(c, t) = α · R_legal(c, t) + β · R_abuse(c, t) + γ · R_values(c, t)
            </pre>
            <ul className="mt-6 list-disc pl-6 space-y-2 text-on-surface-variant text-lg leading-[1.7]">
              <li>
                default (α, β, γ) = (0.4, 0.3, 0.3); the sum MUST be 1.0 — any proposal that
                violates this MUST be rejected
              </li>
              <li>
                <span className="font-mono text-primary">R_legal</span> — signals from DMCA / DSA /
                subpoena / OFAC with per-class weights
              </li>
              <li>
                <span className="font-mono text-primary">R_abuse</span> — user flags weighted by
                reporter reputation and audience-normalized
              </li>
              <li>
                <span className="font-mono text-primary">R_values</span> — classifier output per AUP
                category combined with severity weights s_k
              </li>
              <li>
                absolute exclusion categories ([b] and [c] of the AUP) force R_values = 1.0
                regardless of classifier output
              </li>
            </ul>
          </div>
        </section>

        <section id="s3-thresholds" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            thresholds and enforcement
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-none pl-0 space-y-3 text-on-surface-variant">
              <li>
                <span className="font-mono text-primary">θ_subsidy = 0.5</span> — R(c) above this
                excludes content from Persistence Pool subsidy (RFC 5 §7)
              </li>
              <li>
                <span className="font-mono text-primary">θ_feed = 0.3</span> — R(c) above this
                excludes from curated feed, ranking, and the Boost Router (RFC 8 §4.4)
              </li>
              <li>
                <span className="font-mono text-primary">θ_review = 0.4</span> — triggers Jury
                escalation (RFC 7)
              </li>
            </ul>
            <p>
              <strong>Enforcement is not removal.</strong> None of these actions removes content
              bytes from the network. The CID remains resolvable; any Provider Node that chooses to
              continue hosting MAY do so at its own expense; alternative clients MAY render the
              content under their own editorial criterion. This is the distillation of the
              persistence-is-not-distribution principle at the R(c) boundary.
            </p>
          </div>
        </section>

        <section id="s4-canonical" className="py-12">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8 max-w-[72ch]">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">
              canonical source
            </span>
            <p className="mt-3 text-base leading-[1.7] text-on-surface-variant">
              This page renders a summary of RFC-6. The full normative text (912 lines with RFC 2119
              MUST/SHOULD/MAY language, RiskOracle Solidity interface, DMCA/DSA due-process rules,
              reporter reputation matrix, full Jury appeal workflow, security considerations) is at:
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
