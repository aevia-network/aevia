import type { RFCContent } from './types';

export const rfc0En: RFCContent = {
  toc: [
    { id: 's1-escopo', label: '§1 · scope' },
    { id: 's2-terminologia', label: '§2 · terminology' },
    { id: 's3-arquitetura', label: '§3 · layered architecture' },
    { id: 's4-invariantes', label: '§4 · invariants' },
    { id: 's5-documentos', label: '§5 · normative documents' },
    { id: 's6-seguranca', label: '§6 · security considerations' },
    { id: 's7-referencias', label: '§7 · references' },
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
              This document describes the Aevia Protocol at the overview level. It defines the
              thesis, the layered architecture, and the set of normative RFCs that together
              constitute the specification. Clients and provider nodes intending to be conformant
              MUST implement the RFCs listed in §5 as applicable to their role.
            </p>
            <p>
              The keywords <span className="font-mono text-primary not-italic">MUST</span>,{' '}
              <span className="font-mono text-primary not-italic">SHOULD</span>, and{' '}
              <span className="font-mono text-primary not-italic">MAY</span> are to be interpreted
              as described in RFC 2119.
            </p>
            <p>
              The protocol thesis is: <em>persistence does not imply distribution</em>. The protocol
              separates two layers historically collapsed in commercial platforms: (i) the
              permanence of the bytes (persistence), and (ii) the editorial decision to recommend
              the bytes to an audience (distribution). This separation is architectural and
              irreversible at the protocol level.
            </p>
          </div>
        </section>

        <section id="s2-terminologia" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            terminology
          </h2>
          <div className="mt-6 text-lg leading-[1.7] max-w-[72ch]">
            <dl className="space-y-4">
              <div>
                <dt className="font-mono text-sm text-primary">manifest</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Signed JSON document describing a content item. Normalized by RFC-1.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">cid</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Content Identifier, derived deterministically from the SHA-256 of the content.
                  Normalized by RFC-2.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">provider node</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Process that replicates bytes, proves replication on-chain, and receives
                  fee-for-service compensation.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">content registry</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Solidity contract on Base that anchors the hash of every registered manifest
                  together with its block timestamp.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">persistence pool</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Solidity contract that holds cUSDC and disburses to provider nodes per audited
                  metrics. Normalized by RFC-5.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">risk score</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Function R(c) in [0,1] determining eligibility for subsidy and feed surface.
                  Normalized by RFC-6 (draft).
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">aup</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Acceptable Use Policy. Set of normative exclusions that the protocol neither
                  subsidizes nor indexes. Normalized by RFC-4.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="s3-arquitetura" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            layered architecture
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              The protocol is organized in six layers. A conformant implementation MUST honor the
              order of responsibilities below:
            </p>
            <ol className="list-decimal pl-6 space-y-3 text-on-surface-variant">
              <li>
                <strong className="text-accent">addressing (RFC-2)</strong> — all content is
                referenced by CID. Opaque URLs do not constitute canonical reference.
              </li>
              <li>
                <strong className="text-accent">identity (RFC-3)</strong> — all authorship is proven
                by an EIP-712 signature over the canonical hash of the manifest.
              </li>
              <li>
                <strong className="text-accent">persistence</strong> — Content Registry on Base L2
                anchors manifests; provider nodes replicate the referenced bytes and prove
                replication at regular challenge-response intervals.
              </li>
              <li>
                <strong className="text-accent">network</strong> — libp2p + Kademlia DHT for
                discovery; Circuit Relay v2 for NAT-bound peers; WebTransport for browser viewers.
              </li>
              <li>
                <strong className="text-accent">distribution (RFC-6)</strong> — Risk Score governs
                feed, ranking, and subsidy. The distribution decision is always <em>secondary</em>{' '}
                to persistence.
              </li>
              <li>
                <strong className="text-accent">governance (RFC-7)</strong> — Ecumenical Council of
                12 seats holds veto authority over parameters. Deliberations are anchored on the
                Trust Ledger.
              </li>
            </ol>
          </div>
        </section>

        <section id="s4-invariantes" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            invariants
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>The protocol preserves the following invariants. Conformant implementations MUST:</p>
            <ul className="list-disc pl-6 space-y-3 text-on-surface-variant">
              <li>
                <strong className="text-accent">CID immutability</strong> — no legitimate protocol
                flow alters the bytes associated with a CID. Every content revision produces a new
                manifest with new CIDs.
              </li>
              <li>
                <strong className="text-accent">append-only Registry</strong> — registered manifests
                are not deletable. Revisions layer, they do not overwrite.
              </li>
              <li>
                <strong className="text-accent">persistence/distribution separation</strong> — no
                editorial decision (Risk Score, feed, subsidy) alters byte availability. A CID with
                high R(c) remains retrievable via the DHT; it merely loses subsidy and ranking.
              </li>
              <li>
                <strong className="text-accent">offline verifiability</strong> — manifests MUST be
                verifiable without additional network round-trips given only the manifest, its
                declared CID, and the protocol domain separator.
              </li>
              <li>
                <strong className="text-accent">stablecoin denomination</strong> — provider node
                compensation IS denominated in a dollar-pegged stablecoin (cUSDC on Base). The
                protocol issues no speculative native token.
              </li>
            </ul>
          </div>
        </section>

        <section id="s5-documentos" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            normative documents
          </h2>
          <div className="mt-6 text-lg leading-[1.7] max-w-[72ch]">
            <p className="mb-6 text-on-surface-variant">
              The full specification comprises the following RFCs. Implementations conformant to the
              indicated role MUST implement the RFCs marked.
            </p>
            <ul className="list-none pl-0 space-y-3 font-mono text-sm">
              <li>
                <span className="text-primary">RFC-0</span>{' '}
                <span className="text-on-surface-variant">· overview · this document</span>
              </li>
              <li>
                <span className="text-primary">RFC-1</span>{' '}
                <span className="text-on-surface-variant">
                  · manifest schema · required for creators and provider nodes
                </span>
              </li>
              <li>
                <span className="text-primary">RFC-2</span>{' '}
                <span className="text-on-surface-variant">
                  · content addressing · required for all roles
                </span>
              </li>
              <li>
                <span className="text-primary">RFC-3</span>{' '}
                <span className="text-on-surface-variant">
                  · authentication and signature · required for creators and verifiers
                </span>
              </li>
              <li>
                <span className="text-primary">RFC-4</span>{' '}
                <span className="text-on-surface-variant">
                  · acceptable use policy · required for clients offering a feed
                </span>
              </li>
              <li>
                <span className="text-primary">RFC-5</span>{' '}
                <span className="text-on-surface-variant">
                  · persistence pool · required for provider nodes
                </span>
              </li>
              <li>
                <span className="text-primary">RFC-6</span>{' '}
                <span className="text-on-surface-variant">· risk score · draft, sprint 3</span>
              </li>
              <li>
                <span className="text-primary">RFC-7</span>{' '}
                <span className="text-on-surface-variant">
                  · moderation and ecumenical jury · draft, sprint 4
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section id="s6-seguranca" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            security considerations
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Structural threats to the protocol are addressed in §10 of the whitepaper.
              Implementations MUST consider at least:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                legal coercion against Aevia LLC does not remove on-chain content; alternative
                implementations continue to serve even if the canonical client is ordered to
                de-index.
              </li>
              <li>
                dishonest provider is defeated by the byte-range challenge within a tight window
                (RFC-5 §4).
              </li>
              <li>
                Sybil is neutralized because compensation is proportional to byte-hours replicated,
                not node count.
              </li>
              <li>DHT eclipse is mitigated by bucket refresh with random probing.</li>
              <li>economic capture of the pool triggers Council review (RFC-7).</li>
            </ul>
          </div>
        </section>

        <section id="s7-referencias" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            references
          </h2>
          <div className="mt-6 max-w-[72ch]">
            <ol className="list-decimal pl-6 font-mono text-sm text-on-surface-variant space-y-2">
              <li>IETF RFC 2119 — Key words for RFCs</li>
              <li>RFC-1 — Manifest Schema</li>
              <li>RFC-2 — Content Addressing</li>
              <li>RFC-3 — Authentication and Signature</li>
              <li>RFC-4 — Acceptable Use Policy</li>
              <li>RFC-5 — Persistence Pool</li>
              <li>Aevia Whitepaper v1 (April 2026)</li>
            </ol>
          </div>
        </section>
      </>
    );
  },
};
