import type { RFCContent } from './types';

export const rfc4En: RFCContent = {
  toc: [
    { id: 's1-escopo', label: '§1 · scope' },
    { id: 's2-principio', label: '§2 · separation principle' },
    { id: 's3-exclusoes', label: '§3 · normative exclusions' },
    { id: 's4-thresholds', label: '§4 · enforcement thresholds' },
    { id: 's5-takedown', label: '§5 · legal procedures' },
    { id: 's6-apelacao', label: '§6 · appeal' },
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
              This document is the normative form of the Aevia protocol Acceptable Use Policy (AUP).
              It defines which content categories are not amplified, how operational thresholds
              enforce these restrictions, and the mandatory legal procedures. The UI page at{' '}
              <span className="font-mono">/aup</span> is the human-readable form; this RFC is the
              canonical reference.
            </p>
            <p>MUST, SHOULD, MAY follow RFC 2119.</p>
          </div>
        </section>

        <section id="s2-principio" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            separation principle
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              This AUP governs <em>distribution</em>, not <em>persistence</em>. Content that
              violates §3 remains on IPFS and in the Content Registry; what is revoked is
              persistence pool subsidy, curated feed surface, and ranking weight. Conformant
              implementations MUST preserve CID retrievability of every canonically signed content
              item, regardless of editorial eligibility.
            </p>
            <p>
              This principle is load-bearing for Aevia LLC’s intermediary immunity under 47 U.S.C.
              §230. By moderating distribution under a public criterion, Aevia exercises moderation
              protected by section 230(c)(2)(a); by not suppressing bits, it does not become
              publisher of third-party content.
            </p>
          </div>
        </section>

        <section id="s3-exclusoes" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            normative exclusions
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Conformant implementations MUST exclude the categories below from subsidy and curated
              feed. Categories marked <span className="font-mono text-danger">[ABSOLUTE]</span>{' '}
              additionally MUST be de-indexed and reported per §5.
            </p>
            <ul className="list-none pl-0 space-y-3">
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[a]</span> pornography and sexually
                explicit content.
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[b]</span>{' '}
                <span className="font-mono text-danger">[ABSOLUTE]</span> any sexualization of
                minors — absolute zero tolerance; NCMEC CyberTipline reporting mandatory per 18
                U.S.C. §2258A.
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[c]</span>{' '}
                <span className="font-mono text-danger">[ABSOLUTE]</span> non-consensual intimate
                imagery (NCII), including sexualized deepfakes — per SHIELD Act (15 U.S.C. §6851).
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[d]</span> celebratory apologia of
                violence, terrorism, or physical harm to persons.
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[e]</span> celebratory apologia of
                abortion.
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[f]</span> occultism, satanism, and
                witchcraft as practice.
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[g]</span> apologia of recreational illicit
                drug use.
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[h]</span> actionable hate speech against
                any group — including christians, jews, muslims, atheists, and any other.
              </li>
            </ul>
          </div>
        </section>

        <section id="s4-thresholds" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            enforcement thresholds
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Operational decisions are made via the Risk Score (RFC-6). This AUP specifies the
              thresholds:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono text-primary">θ_subsidy = 0.5</span> — CIDs with R(c) ≥
                0.5 ARE excluded from persistence pool compensation.
              </li>
              <li>
                <span className="font-mono text-primary">θ_feed = 0.3</span> — CIDs with R(c) ≥ 0.3
                ARE excluded from curated feed and ranking in Aevia clients.
              </li>
              <li>
                <span className="font-mono text-danger">[ABSOLUTE]</span> content MUST have{' '}
                <span className="font-mono">R_values = 1</span> regardless of classifier output, and
                additionally MUST be de-indexed and (for [b]) escalated to NCMEC within 24 hours of
                detection.
              </li>
            </ul>
            <p>
              Thresholds and formula weights are protocol parameters subject to Council approval
              (RFC-7).
            </p>
          </div>
        </section>

        <section id="s5-takedown" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            legal procedures
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>Implementations operating as intermediary under US/EEA jurisdiction MUST:</p>
            <ul className="list-disc pl-6 space-y-3 text-on-surface-variant">
              <li>
                <strong className="text-accent">DMCA §512</strong> — designate an agent with the
                U.S. Copyright Office, accept notices containing elements required by §512(c)(3),
                honor the 10–14 business-day counter-notification window, apply a strikes policy
                (1st=warning, 2nd=manual review + suspension, 3rd=termination).
              </li>
              <li>
                <strong className="text-accent">DSA art. 16</strong> — operate a notice-and-action
                channel, respond within 7 business days with reasoned justification when the
                decision is unfavorable to the notifier.
              </li>
              <li>
                <strong className="text-accent">NCMEC CyberTipline</strong> — report apparent CSAM
                within 24h; preserve material for 90 days per §2258A(h); not review beyond the
                minimum required to report.
              </li>
              <li>
                <strong className="text-accent">OFAC</strong> — not provide service to
                residents/entities in jurisdictions under comprehensive sanctions; consult the SDN
                List.
              </li>
            </ul>
          </div>
        </section>

        <section id="s6-apelacao" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            appeal
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Creators whose content has been restricted MAY request jury review per RFC-7. The
              request MUST:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>be sent within 30 days of the restriction notification;</li>
              <li>
                contain the CID in dispute and a justification that the §3 classification is
                incorrect;
              </li>
              <li>be signed by the creator’s key (RFC-3) to prevent abuse by third parties.</li>
            </ul>
            <p>
              Appeal decisions MUST be published on the Trust Ledger with a textual justification.
              Reclassifications result in an update to the{' '}
              <span className="font-mono">R_abuse</span> and{' '}
              <span className="font-mono">R_values</span> components of the Risk Score.
            </p>
            <p>
              <span className="font-mono text-danger">[ABSOLUTE]</span> categories do NOT admit
              appeal. This restriction is deliberate.
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
                flag spam: malicious reporters may attempt to inflate{' '}
                <span className="font-mono">R_abuse</span> via mass reporting. Implementations
                SHOULD weight by reporter reputation and require a minimum cost per report.
              </li>
              <li>
                adversarial classifier: content may be crafted to evade{' '}
                <span className="font-mono">R_values</span> classifiers. Manual jury review is the
                last-stage recourse.
              </li>
              <li>
                regulatory capture: attempts by governmental pressure to extend the §3 list MUST
                pass through the Council and the Trust Ledger — with no unilateral path via Aevia
                LLC.
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
              <li>17 U.S.C. §512 — DMCA safe harbor</li>
              <li>47 U.S.C. §230 — Section 230 intermediary immunity</li>
              <li>18 U.S.C. §2258A — NCMEC reporting requirements</li>
              <li>15 U.S.C. §6851 — SHIELD Act</li>
              <li>Regulation (EU) 2022/2065 — Digital Services Act</li>
              <li>RFC-6 — Risk Score (draft)</li>
              <li>RFC-7 — Moderation and Ecumenical Jury (draft)</li>
            </ol>
          </div>
        </section>
      </>
    );
  },
};
