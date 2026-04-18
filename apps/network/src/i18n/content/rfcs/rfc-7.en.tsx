import type { RFCContent } from './types';

const CANONICAL_URL =
  'https://github.com/aevia-network/aevia/blob/main/docs/protocol-spec/7-moderation-jury.md';

export const rfc7En: RFCContent = {
  toc: [
    { id: 's1-abstract', label: 'abstract' },
    { id: 's2-composition', label: '§3 · council composition' },
    { id: 's3-governance', label: '§4 · parameter governance' },
    { id: 's4-trust-ledger', label: '§6 · trust ledger' },
    { id: 's5-canonical', label: 'canonical in docs/' },
  ],
  Body() {
    return (
      <>
        <section id="s1-abstract" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">abstract</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            Moderation and Ecumenical Council
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Specifies the <strong>Ecumenical Council</strong> and the <strong>Jury</strong>{' '}
              procedure through which Aevia&apos;s distribution-layer decisions are governed. The
              Council is a twelve-seat body with four-year terms that holds veto authority over
              protocol parameters affecting persistence, distribution, and the Pool. The Jury is the
              subset of Council members that reviews contested Risk Scores and individual
              content-level disputes on a rolling basis.
            </p>
            <p>
              The Council exists to resolve a structural tension. Token-weighted governance
              converges on plutocracy at scale. Person-weighted democratic governance is vulnerable
              to Sybil attack at the identity layer. Aevia deliberately chooses neither. The Council
              is a fixed-size plural body: twelve individuals with publicly declared theological,
              philosophical, and professional perspectives, no single tradition holding a majority,
              each with a one-time-per-term veto on parameter proposals they judge incompatible with
              the protocol&apos;s stated values.
            </p>
            <p>
              Every deliberation, vote, veto, and dissenting opinion is published to the{' '}
              <strong>Trust Ledger</strong>, a Merkle-anchored log on Base L2. Any party — creator,
              Provider Node, Operator, regulator, journalist — can audit the protocol&apos;s
              moderation history from it.
            </p>
          </div>
        </section>

        <section id="s2-composition" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            council composition
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>exactly 12 seats, 4-year terms, staggered rotation</li>
              <li>
                plurality constraint (MUST): no single declared tradition may hold more than 4 of
                the 12 seats
              </li>
              <li>
                recognized traditions (v0.1): Eastern Orthodox, Roman Catholic, Reformed,
                Evangelical Non-Reformed, Pentecostal/Charismatic, Jewish, Muslim, other
                monotheistic, secular/non-affiliated, other (Buddhist, Hindu, indigenous)
              </li>
              <li>seats held by real individuals, not organizations or DAOs</li>
              <li>mandatory recusal on material conflict of interest</li>
              <li>
                removal-for-cause by ≥9/12 (supermajority) — veto does not apply; causes: fraud,
                public AUP violation, sustained inactivity, felony conviction related to the
                protocol
              </li>
            </ul>
          </div>
        </section>

        <section id="s3-governance" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            parameter governance
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>Canonical workflow (MUST) for every Council-governable parameter change:</p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant">
              <li>proposal submission with ≥500-word justification on the Trust Ledger</li>
              <li>
                <strong>21 days</strong> of open comment period (any DID may comment)
              </li>
              <li>
                <strong>14 days</strong> voting (≥7/12 simple majority; ≥9/12 for governance-rule
                changes)
              </li>
              <li>
                48h for any member to exercise <strong>per-term veto</strong> (one per term) with
                ≥500-word justification
              </li>
              <li>
                Operator implementation within 7 days (parameters) or 30 days (contract deployment),
                with transition period when applicable
              </li>
            </ol>
            <p>
              <strong>Not council-governable:</strong> AUP absolute exclusions [b] and [c], RFC 8 §7
              invariants, Council composition rules themselves (except ≥9/12 + 90 days comment),
              native-token prohibition (RFC 8 INV-8).
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
              Append-only log of governance events, DID-signed, Merkle root anchored on Base L2 via{' '}
              <span className="font-mono">LedgerAnchor.sol</span> per-epoch (default weekly).
              Discoverable via:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono">aevia.network/transparency</span> — human-readable
              </li>
              <li>
                public REST/gRPC API at{' '}
                <span className="font-mono">trust-ledger.aevia.network</span>
              </li>
              <li>direct Merkle tree queries via the LedgerAnchor contract</li>
            </ul>
            <p>
              Event kinds: council_induction, parameter_proposal, parameter_vote, parameter_veto,
              jury_convened, jury_decision, jury_dissent, risk_score, risk_contest, election_result,
              etc. Each event is signature-verifiable offline from its canonical JSON (RFC 8785) and
              the signer&apos;s public key.
            </p>
          </div>
        </section>

        <section id="s5-canonical" className="py-12">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8 max-w-[72ch]">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">
              canonical source
            </span>
            <p className="mt-3 text-base leading-[1.7] text-on-surface-variant">
              This page renders a summary of RFC-7. The full normative text (911 lines with RFC 2119
              language, full Jury procedure, Council Fund compensation structure, bootstrap and
              rotation, post-bootstrap ranked-choice elections, security considerations covering
              council capture / Jury bribery / pseudonymous attack) is at:
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
