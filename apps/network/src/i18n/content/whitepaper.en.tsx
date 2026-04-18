import type { ReactNode } from 'react';

export function WhitepaperBody(): ReactNode {
  return (
    <>
      {/* Abstract */}
      <section id="abstract" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">abstract</span>
        <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
          Abstract
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            We describe Aevia, a protocol that separates the persistence of video content from its
            distribution. Creators sign typed manifests that enumerate content by immutable content
            identifiers (CIDs) and anchor those manifests on a public Ethereum Layer 2.
            Independently operated provider nodes replicate the referenced bytes and receive
            fee-for-service compensation in a fiat-pegged stablecoin, audited through a periodic
            challenge-response proof-of-replication protocol. Distribution — ranking, subsidy, and
            feed surfacing — is governed by a public risk score and a twelve-seat ecumenical council
            with veto authority over protocol parameters. The resulting architecture gives a
            creator&apos;s work a property that existing video platforms do not provide: its
            continued existence is not conditional on the continued favor of any single custodian.
          </p>
        </div>
      </section>

      <section id="s1-introduction" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§1</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Introduction
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Commercial video platforms operate a shared, implicit contract with their creators: the
            creator provides content, and the platform provides distribution in exchange for an
            advertising or subscription share. The contract is fragile. A platform&apos;s legal,
            commercial, or political incentives can shift — and when they do, creators are
            deplatformed, monetization is revoked, and content is removed. The prior audience
            becomes inaccessible not because the underlying bytes were destroyed, but because the
            single path that connected the bytes to the audience was severed.
          </p>
          <p>
            The symmetric failure mode is equally corrosive. Some platforms choose to amplify
            material the surrounding society has decided does not deserve amplification. The result
            is an endless public argument in which every side is convinced that some other side has
            captured the moderation apparatus.
          </p>
          <p>
            Both failures share a structural assumption: that <em>hosting</em> and{' '}
            <em>recommending</em> are the same act. A platform holds the bytes <em>and</em> decides
            who sees them. If we separate those two decisions — if we treat persistence (the bytes
            continue to exist) and distribution (the bytes are shown to people) as independent
            architectural layers — we can be honest about moderation: any platform that recommends
            anything is curating, and pretending otherwise is either dishonest or naive. But the
            bytes themselves do not need to disappear to be de-curated.
          </p>
          <p>
            This paper describes Aevia, a protocol and a set of reference clients that separate
            persistence from distribution. The protocol is content-addressed and anchored to a
            public blockchain. Replication is performed by independently operated provider nodes,
            compensated for their service in a stablecoin. Distribution — ranking, feed surfacing,
            subsidy — is governed by a published risk score and a rotating jury. The resulting
            architecture has a property that existing video platforms do not: the continued
            existence of a creator&apos;s work is not contingent on the continued favor of any
            single custodian.
          </p>
          <p>
            We call this property <em>sovereignty</em>. The paper&apos;s central axiom —{' '}
            <em>persistence does not imply distribution</em> — is both a design principle and a
            constraint. It is what makes the architecture honest: we do not pretend to be neutral
            about what we recommend, and we do not pretend to control what merely exists.
          </p>
          <p>
            The remainder of this paper is organized as follows. §2–§4 describe the persistence
            layer: content addressing, signed manifests, and the on-chain registry. §5–§6 describe
            the replication and network layers. §7–§8 describe the distribution layer and its
            governance. §9 analyzes the privacy model. §10 examines adversaries. §11 and §12 cover
            light-client verification and the economic steady state. §13 situates Aevia among
            related systems. §14 concludes.
          </p>
        </div>
      </section>

      <section id="s2-content-addressing" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§2</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Content Addressing
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            The smallest unit of storage in Aevia is an <em>object</em>: an arbitrary byte sequence,
            typically a video segment, an image, or a manifest. Every object is identified by its
            Content Identifier (CID), derived deterministically from the object&apos;s content by a
            cryptographic hash function.
          </p>
          <p>
            We adopt CIDv1 as specified by the Multiformats project [3]. A CID encodes the hash
            algorithm, the hash digest, and the content codec. Aevia fixes the hash algorithm to
            SHA-256 and the textual encoding to multibase base32 to ensure a canonical, URL-safe
            representation. For any object <span className="font-mono">O</span>, its CID is:
          </p>
        </div>
        <div className="mt-8 flex justify-center py-6">
          <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent">
            CID(O) = &quot;b&quot; || base32(codec || 0x12 || 0x20 || SHA-256(O))
          </pre>
        </div>
        <div className="mt-4 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            where <span className="font-mono">codec</span> is the multicodec prefix identifying the
            content type (<span className="font-mono">raw</span> = 0x55 for opaque bytes,{' '}
            <span className="font-mono">json</span> = 0x0200 for structured manifests),{' '}
            <span className="font-mono">0x12</span> is the multihash identifier for SHA-256, and{' '}
            <span className="font-mono">0x20</span> is the digest length in bytes (32).
          </p>
          <p>
            Two properties of this scheme are load-bearing for the rest of the protocol. First,{' '}
            <em>immutability</em>: the CID is a function of the bytes; any modification of a single
            bit changes the hash and therefore the CID. Two parties referring to the same CID hold
            byte-identical content. Second, <em>location independence</em>: the CID does not embed a
            host, a URL, or an operator. A CID can be satisfied by any node that holds the bytes;
            the protocol does not privilege any particular source.
          </p>
          <p>
            Aevia manifests reference video segments by CID, not by URL. This is the minimum
            sufficient condition for persistence: a creator&apos;s content can be served by{' '}
            <em>any</em> willing operator, because the request is for &ldquo;give me the object
            whose SHA-256 is X,&rdquo; not &ldquo;give me whatever is hosted at URL Y.&rdquo;
          </p>
        </div>
      </section>

      <section id="s3-signed-manifests" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§3</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Signed Manifests
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            A <em>manifest</em> is a structured JSON document describing a content item. The
            manifest enumerates segments by CID, carries metadata (creator, timestamp, duration),
            and is cryptographically signed by the creator. The manifest schema, in abbreviated
            form, is:
          </p>
        </div>
        <pre className="mt-8 overflow-x-auto rounded-lg bg-surface-lowest p-6 font-mono text-sm text-on-surface-variant">
          <code>{`{
  "version": 1,
  "cid": "<CID of the manifest body itself>",
  "creator": "<EIP-55 Ethereum address>",
  "created_at": "<RFC 3339 timestamp>",
  "content_type": "video/hls" | "video/vod" | "image" | "document",
  "duration_seconds": <number | null>,
  "hls": {
    "master_playlist_cid": "<CID>",
    "segments": ["<CID>", "<CID>", ...]
  } | null,
  "signature": "<0x-prefixed 65-byte secp256k1 signature>"
}`}</code>
        </pre>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            The signature is computed over the canonical JSON encoding [2] of the manifest with the{' '}
            <span className="font-mono">signature</span> field excluded. The signing key is the
            creator&apos;s Ethereum private key, and the signature follows the EIP-712 [6]
            typed-data format with a domain separator fixed to the Aevia protocol and its chain ID.
          </p>
          <p>
            Verification is deterministic and offline. Given a manifest{' '}
            <span className="font-mono">M</span>, a verifier:
          </p>
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              Extracts <span className="font-mono">M.signature</span> and removes it from{' '}
              <span className="font-mono">M</span> to obtain{' '}
              <span className="font-mono">M&apos;</span>.
            </li>
            <li>
              Computes the canonical JSON encoding of <span className="font-mono">M&apos;</span>.
            </li>
            <li>
              Computes the EIP-712 digest over the canonical bytes and the Aevia domain separator.
            </li>
            <li>
              Recovers the signer address from <span className="font-mono">M.signature</span> and
              the digest.
            </li>
            <li>
              Checks that the recovered address equals <span className="font-mono">M.creator</span>.
            </li>
          </ol>
          <p>
            Any mismatch in any step invalidates the manifest. No network round-trip is required;
            the verifier needs only the manifest bytes and the domain separator. This property makes
            lightweight offline verification practical (§11).
          </p>
        </div>
      </section>

      <section id="s4-content-registry" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§4</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Content Registry
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Signatures prove authorship. They do not prove time — a signature tells a verifier{' '}
            <em>who</em> signed, not <em>when</em>. For a public protocol, timestamp proof matters:
            it establishes precedence, resolves disputes, and enables time-bounded reasoning such as
            takedown windows and jury rotation.
          </p>
          <p>
            Aevia uses an on-chain Content Registry for timestamp anchoring. The registry is a
            Solidity contract deployed on Base, an Ethereum Layer 2 rollup. The contract exposes a
            single mutating operation:
          </p>
        </div>
        <pre className="mt-8 overflow-x-auto rounded-lg bg-surface-lowest p-6 font-mono text-sm text-on-surface-variant">
          <code>{`function register(bytes32 manifestHash, address creator)
    external
    returns (uint64 registeredAt);`}</code>
        </pre>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            The contract stores{' '}
            <span className="font-mono">(manifestHash → (creator, registeredAt))</span> and emits an
            event on each registration. The on-chain block timestamp provides an authoritative lower
            bound on the manifest&apos;s age.
          </p>
          <p>
            We chose Base for three reasons. First, Base inherits Ethereum security via optimistic
            rollup fraud proofs; no separate trust assumption is needed beyond Ethereum&apos;s.
            Second, Base fees are approximately 0.1–1% of Ethereum Layer 1 fees, making registration
            economical for individual creators. Third, Base&apos;s account abstraction
            infrastructure allows Aevia to sponsor gas for creators via a relayer, so a first-time
            creator signs a manifest without holding native ETH.
          </p>
          <p>
            Gas-sponsored registration is important for onboarding but must not create a trust
            bottleneck. The relayer is permissionless in the sense that any sponsor may submit any
            signed manifest; the signature is verified on-chain, and the sponsor receives a fixed
            fee per registration. Sponsors cannot forge manifests or modify the registered data.
          </p>
          <p>
            The registry is append-only: registered manifests cannot be removed, only superseded by
            subsequent registrations. A creator who wishes to publish a revision registers a new
            manifest pointing to new CIDs; the old manifest remains in the registry with its
            original timestamp. Consumers select the latest version by querying the registry. This
            is deliberate: the Registry serves as an historical record of what was published, which
            is independent of whether a given version remains current.
          </p>
        </div>
      </section>

      <section id="s5-persistence-pool" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§5</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Persistence Pool
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            The Content Registry proves that content <em>existed</em> at a specific time; it does
            not ensure that the content remains <em>accessible</em>. Accessibility requires that the
            raw bytes — the video segments themselves — continue to live on physical infrastructure
            operated by willing custodians.
          </p>
          <p>
            Aevia&apos;s persistence layer is an economic market. Provider nodes replicate content
            and are compensated, in a dollar-denominated stablecoin (cUSDC on Base), for time spent
            hosting and responding to retrieval requests. The compensation contract — the
            Persistence Pool — holds a running balance in cUSDC and disburses to provider nodes
            based on auditable metrics.
          </p>
          <p>
            A provider node&apos;s compensation over a payment epoch{' '}
            <span className="font-mono">t</span> is:
          </p>
        </div>
        <div className="mt-8 flex justify-center py-6">
          <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent">
            P_i(t) = R_i(t) · B_i(t) · W_region(i) · ρ(t)
          </pre>
        </div>
        <div className="mt-4 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>where:</p>
          <ul className="ml-4 list-disc space-y-2 pl-4">
            <li>
              <span className="font-mono">R_i(t)</span> is the fraction of replication challenges
              successfully answered by node <span className="font-mono">i</span> during epoch{' '}
              <span className="font-mono">t</span>, in [0, 1].
            </li>
            <li>
              <span className="font-mono">B_i(t)</span> is the total byte-hours of content
              replicated by node <span className="font-mono">i</span> during epoch{' '}
              <span className="font-mono">t</span>.
            </li>
            <li>
              <span className="font-mono">W_region(i)</span> ∈ {'{'}0.5, 1.0, 1.5{'}'} is a region
              weight encoding geographic redundancy (low, medium, high scarcity).
            </li>
            <li>
              <span className="font-mono">ρ(t)</span> is the pool&apos;s unit rate for epoch{' '}
              <span className="font-mono">t</span>, computed as{' '}
              <span className="font-mono">(pool_balance · ε) / Σ_i (R_i · B_i · W_region)</span>,
              where <span className="font-mono">ε</span> is the per-epoch disbursement fraction.
            </li>
          </ul>
          <p>
            The challenge-response protocol is the core of the replication proof. At random
            intervals, the pool contract emits a challenge <span className="font-mono">c_k</span>{' '}
            consisting of (i) a target CID <span className="font-mono">x</span>, (ii) a random byte
            range <span className="font-mono">[a, b]</span> within the object identified by{' '}
            <span className="font-mono">x</span>, and (iii) a block number{' '}
            <span className="font-mono">n</span> at which the challenge expires.
          </p>
          <p>
            Each provider node claiming to hold <span className="font-mono">x</span> must respond
            before block <span className="font-mono">n</span> with the raw bytes{' '}
            <span className="font-mono">x[a..b]</span> and an on-chain proof commitment. The
            contract verifies the bytes against the known CID; for large objects, a Merkle tree of
            content chunks allows O(log n) verification without storing the full object on-chain. A
            correct, timely response increments <span className="font-mono">R_i</span>; a missing or
            incorrect response decrements it.
          </p>
          <p>
            The protocol resists two attacks. A node claiming to hold content it does not have
            cannot respond to a random-range challenge without storing the content; fetching from a
            peer at challenge time is defeated by tight response windows (typical inter-peer fetch
            latency exceeds the challenge window). A node that has stored the content but is offline
            at challenge time is indistinguishable from one that has lost the data; the protocol
            treats both as failures, which is the correct incentive — the contract pays for{' '}
            <em>availability</em>, not for <em>claimed custody</em>.
          </p>
          <p>
            Challenges are Poisson-distributed with expected rate{' '}
            <span className="font-mono">λ</span> per node per epoch. Setting{' '}
            <span className="font-mono">λ</span> such that the expected number of challenges per
            epoch is large (e.g., 100 or more) reduces the variance of{' '}
            <span className="font-mono">R_i</span> and makes compensation predictable for honest
            operators.
          </p>
        </div>
      </section>

      <section id="s6-network-layer" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§6</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Network Layer
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Content must flow from provider nodes to viewers. Aevia uses libp2p as the transport
            substrate and the Kademlia distributed hash table (DHT) [9] for content discovery.
          </p>
          <p>
            Every provider node operates a libp2p host identified by a self-generated ed25519
            keypair. The host participates in a Kademlia DHT scoped to the protocol namespace{' '}
            <span className="font-mono">/aevia/kad/1.0.0</span>. The DHT stores mappings{' '}
            <span className="font-mono">(cid → [provider_peer_id, ...])</span>, allowing any node to
            discover which peers claim to hold a given CID. The DHT is eventually consistent under
            honest-majority assumptions; providers that newly replicate a CID call{' '}
            <span className="font-mono">Provide(cid)</span> to announce availability, and viewers
            call <span className="font-mono">FindProviders(cid)</span> to retrieve the current set
            of candidate peers.
          </p>
          <p>
            Peers behind NAT or restrictive firewalls cannot be reached by direct dial. We address
            this with Circuit Relay v2: NATted peers register with public relay nodes and announce
            their reachable identity{' '}
            <span className="font-mono">/p2p/&lt;relay&gt;/p2p-circuit/p2p/&lt;peer&gt;</span> in
            the DHT. Viewers dial the relay identity; the relay forwards the encrypted stream.
          </p>
          <p>
            For browser-based viewers, Aevia uses WebTransport and WebRTC. The client establishes a
            WebTransport connection to a provider node — directly when possible, through a libp2p
            WebTransport gateway otherwise — and requests HLS segments by CID. The provider serves
            the bytes after verifying the requester is within applicable rate limits.
          </p>
          <p>
            Content retrieval is opportunistic and parallel. A client may request the same CID from
            multiple providers concurrently, accepting the first valid response. A valid response is
            one whose bytes hash to the expected CID; invalid responses are discarded without retry
            to that peer. This design provides natural defense against malicious providers serving
            corrupted content: the client discovers corruption immediately and selects an honest
            peer from the remaining candidates.
          </p>
        </div>
      </section>

      <section id="s7-risk-score" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§7</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Risk Score
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            The protocol&apos;s distribution decisions — which content receives subsidy from the
            persistence pool, which content is surfaced in the curated feed, which content the
            ranking algorithm boosts — are governed by a Risk Score. The Risk Score is an off-chain
            computation with a published formula:
          </p>
        </div>
        <div className="mt-8 flex justify-center py-6">
          <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent">
            R(c) = α · R_legal(c) + β · R_abuse(c) + γ · R_values(c)
          </pre>
        </div>
        <div className="mt-4 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            with default weights α = 0.4, β = 0.3, γ = 0.3. Each component is normalized to the
            interval [0, 1]:
          </p>
          <ul className="ml-4 list-disc space-y-3 pl-4">
            <li>
              <span className="font-mono">R_legal(c)</span> reflects the content&apos;s legal-risk
              signal. Inputs include DMCA takedown requests targeting the CID [11], DSA
              notice-and-action reports [12], and subpoenas. A CID with no legal signals has{' '}
              <span className="font-mono">R_legal = 0</span>; a CID with an active, un-rebutted
              takedown has <span className="font-mono">R_legal ≈ 1</span>.
            </li>
            <li>
              <span className="font-mono">R_abuse(c)</span> reflects user-report and jury signals.
              Inputs include flag counts (weighted by reporter reputation), jury review outcomes,
              and prior-content signals from the same creator. A new CID from a new creator begins
              with <span className="font-mono">R_abuse = 0</span>; accumulated jury decisions raise
              or lower the score.
            </li>
            <li>
              <span className="font-mono">R_values(c)</span> reflects alignment with the Acceptable
              Use Policy (AUP). Inputs include a classifier output (trained on a public dataset of
              AUP-conforming and AUP-excluded content) and manual review outcomes.{' '}
              <span className="font-mono">R_values</span> is higher for content that the classifier
              or reviewers identify as within the AUP&apos;s excluded categories.
            </li>
          </ul>
          <p>Two thresholds govern protocol behavior:</p>
          <ul className="ml-4 list-disc space-y-2 pl-4">
            <li>
              <span className="font-mono">R(c) ≥ θ_subsidy</span> excludes{' '}
              <span className="font-mono">c</span> from persistence-pool subsidy. Provider nodes
              replicating <span className="font-mono">c</span> receive no{' '}
              <span className="font-mono">W_region</span>-weighted compensation; they may still hold
              and serve <span className="font-mono">c</span> at their own expense.
            </li>
            <li>
              <span className="font-mono">R(c) ≥ θ_feed</span> excludes{' '}
              <span className="font-mono">c</span> from the curated feed and ranking surfaces
              operated by Aevia clients. The content remains retrievable by CID; it simply is not
              promoted.
            </li>
          </ul>
          <p>
            Default thresholds are <span className="font-mono">θ_subsidy = 0.5</span> and{' '}
            <span className="font-mono">θ_feed = 0.3</span>. Both are parameters of the protocol,
            subject to governance (§8). The absolute numbers are less important than the design
            property: the decision to subsidize or surface is public, auditable, and contestable.
          </p>
          <p>
            The component scores <span className="font-mono">R_legal</span>,{' '}
            <span className="font-mono">R_abuse</span>, <span className="font-mono">R_values</span>{' '}
            are recomputed periodically and published to a public Trust Ledger, where every score
            change carries a cryptographic signature from the pool&apos;s ranking service. A creator
            who believes a score is incorrect can request a jury review (§8).
          </p>
        </div>
      </section>

      <section id="s8-governance" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§8</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Governance
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Parameter changes — the α, β, γ weights; the{' '}
            <span className="font-mono">θ_subsidy</span>, <span className="font-mono">θ_feed</span>{' '}
            thresholds; the challenge rate <span className="font-mono">λ</span>; the per-epoch
            disbursement <span className="font-mono">ε</span> — are not at the discretion of Aevia
            LLC. They are decided by an Ecumenical Council: twelve independent seats, four-year
            terms, with veto authority over parameter proposals.
          </p>
          <p>
            The Council&apos;s composition is deliberately plural. Seats are held by individuals
            (not organizations) with a publicly declared theological, philosophical, or professional
            perspective: practicing clergy, secular legal scholars, human rights activists,
            technical cryptographers, and others. No single tradition or interest holds a majority.
            A parameter proposal requires simple majority (≥7/12) to pass, but any Council member
            may exercise a one-time veto per term to block a proposal they judge incompatible with
            the protocol&apos;s stated values.
          </p>
          <p>
            Council deliberations are recorded on the public Trust Ledger. Each deliberation
            publishes: the proposal text, per-member votes, veto invocations, and dissenting
            opinions. The Ledger is itself a Merkle-anchored log on Base, making it auditable and
            append-only.
          </p>
          <p>
            Council elections occur every four years. The electorate is the set of established
            operators — creators and provider nodes who have been active for at least twelve months
            and who have maintained AUP conformance. Election mechanics are themselves governed by
            the Council (meta-governance); the initial bootstrap Council is appointed by Aevia LLC
            with a public justification for each seat.
          </p>
          <p>
            This structure balances two tensions. First, centralized governance collapses to the
            preferences of Aevia LLC; the Council exists to prevent this. Second, purely
            decentralized governance suffers either from plutocracy (one token, one vote) or from
            Sybil risk (one person, one vote, where &ldquo;person&rdquo; is unverifiable). The fixed
            twelve seats, long terms, and plural composition are a deliberate simplification that
            trades off some legitimacy for predictable, non-capturable decision-making.
          </p>
        </div>
      </section>

      <section id="s9-privacy-model" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§9</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Privacy Model
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            Aevia&apos;s privacy guarantees follow from its architecture rather than from
            operational opacity. Three threat models bound the analysis.
          </p>
          <p>
            <em>Passive observer.</em> An entity that watches the public blockchain and public IPFS
            gateway traffic observes every registered manifest (creator address, timestamp, CID),
            every public provider-node peer ID, and every DHT announcement. It cannot observe which
            viewer watched which content (unless the viewer fetches through a public gateway), email
            addresses, or IP addresses of creators signing through the relayer.
          </p>
          <p>
            <em>Active adversary.</em> An entity that operates one or more malicious provider nodes,
            joins the DHT, and observes retrieval requests sees which CIDs are requested from their
            nodes and from which peer IDs. It cannot observe the real-world identity of the
            requesting peer (peer IDs are ephemeral and regenerated frequently) or aggregate
            viewership of any CID (each adversary sees only requests routed to them).
          </p>
          <p>
            <em>Legal coercion.</em> A government or party that obtains a court order compelling
            Aevia LLC to disclose data has access to any data Aevia LLC holds: creator email
            addresses (if provided), relayer logs (retained thirty days), payment records, and
            Council deliberations. It does not have access to data Aevia LLC does not hold, which
            includes the on-chain manifests (already public), the content bytes stored by
            independent provider nodes outside Aevia LLC&apos;s control, and the real-world
            identities of viewers (not collected).
          </p>
          <p>
            The protocol&apos;s privacy properties are asymmetric by design. Authorship is public
            (creators sign manifests with on-chain wallets); viewership is private (no identity
            tracking at the retrieval layer); administrative metadata is legally discoverable but
            deliberately minimized.
          </p>
          <p>
            Creators who require anonymity have two paths. They may sign with a wallet unconnected
            to their real-world identity, accepting the operational burden of key management. Or
            they may sign through a pseudonymous relayer — a service that re-signs manifests on
            behalf of creators after a KYC check, retaining only the pseudonym linkage. Aevia does
            not operate such a relayer in v1; the protocol admits their construction by third
            parties.
          </p>
        </div>
      </section>

      <section id="s10-adversarial-analysis" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§10</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Adversarial Analysis
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>We analyze five attack classes.</p>
          <p>
            <strong>(a) Dishonest provider.</strong> An adversary operates a provider node that
            claims to hold content it does not have, collecting subsidy fraudulently. The
            challenge-response protocol (§5) requires the provider to produce arbitrary byte ranges
            of claimed content within a tight deadline. Fetching from a peer at challenge time is
            blocked by the deadline. The probability of a dishonest provider surviving epoch{' '}
            <span className="font-mono">t</span> undetected, given{' '}
            <span className="font-mono">λ</span> challenges per epoch and per-challenge detection
            probability <span className="font-mono">p</span>, is{' '}
            <span className="font-mono">(1 − p)^λ</span>. With{' '}
            <span className="font-mono">λ = 100</span> and{' '}
            <span className="font-mono">p = 0.9</span>, the survival probability is{' '}
            <span className="font-mono">10^−100</span>. In practice the adversary is detected in the
            first epoch.
          </p>
          <p>
            <strong>(b) Sybil provider.</strong> An adversary operates many provider-node identities
            to inflate their compensation share. Compensation is proportional to byte-hours
            replicated and audited, not to node count. An adversary running one hundred Sybil nodes
            each holding 1% of the content receives the same total compensation as a single node
            holding 100% — the sum is the same. The adversary cannot inflate{' '}
            <span className="font-mono">B_i</span> without actually holding the bytes. The{' '}
            <span className="font-mono">W_region</span> weight introduces a minor incentive for
            geographic diversity, which slightly favors genuine multi-site operators, but Sybil is
            not the critical threat vector here.
          </p>
          <p>
            <strong>(c) Censorship via legal coercion.</strong> An adversary pressures Aevia LLC to
            remove a specific manifest from the Content Registry. The Registry is append-only and
            on-chain; Aevia LLC cannot unilaterally delete a registered manifest. Aevia LLC can be
            ordered to stop indexing a CID in its client surfaces, but indexing is an editorial
            decision, not a protocol decision. The manifest remains on Base, discoverable via block
            explorer; provider nodes outside Aevia LLC&apos;s jurisdiction continue to serve the
            content; alternative clients can render it. This is the architectural expression of
            persistence ≠ distribution.
          </p>
          <p>
            <strong>(d) Eclipse attack on DHT.</strong> An adversary fills the DHT routing table of
            a target peer with adversary-controlled identities, isolating the target from honest
            peers. Kademlia&apos;s <span className="font-mono">k</span>-bucket structure requires an
            adversary to control an adversary-majority of peers in the target&apos;s routing-table
            buckets, which are <span className="font-mono">k</span> wide per bucket and cover the
            target&apos;s key-space neighborhood. For a network of 10,000 peers and{' '}
            <span className="font-mono">k = 20</span>, the attack requires on the order of ~160
            strategically placed adversarial peer IDs. Aevia&apos;s DHT additionally uses bucket
            refresh with random probing, which prevents permanent eclipse; a refreshed bucket will
            include new honest peers as they join. The attack is expensive and transient.
          </p>
          <p>
            <strong>(e) Economic attack on the Persistence Pool.</strong> An adversary who controls
            a large share of the pool&apos;s compensation flows can drive down the per-epoch rate
            for honest operators. We do not claim a provably secure defense. The protocol&apos;s
            empirical defense is pluralism: the pool contract is public, adversary behavior is
            auditable, and a persistent attack triggers Council review (§8). If an adversary
            captures the pool, the Council can propose a fork of the compensation contract that
            excludes the adversary; the Council&apos;s veto structure makes this a possible but
            deliberately non-trivial action.
          </p>
        </div>
      </section>

      <section id="s11-simplified-verification" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§11</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Simplified Verification
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            A light client — a viewer that does not maintain a full index of the Content Registry —
            can verify a manifest&apos;s validity and currency with a small number of network
            requests.
          </p>
          <p>
            Given a manifest <span className="font-mono">M</span> claimed to be current for creator
            address <span className="font-mono">c</span> at time{' '}
            <span className="font-mono">t</span>:
          </p>
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              Compute the canonical hash{' '}
              <span className="font-mono">h = H(canonical(M \ signature))</span>.
            </li>
            <li>
              Query the Content Registry:{' '}
              <span className="font-mono">
                registeredAt, registeredCreator = Registry.lookup(h)
              </span>
              .
            </li>
            <li>
              Verify <span className="font-mono">registeredCreator == c</span>.
            </li>
            <li>
              Verify <span className="font-mono">registeredAt ≤ t</span>.
            </li>
            <li>
              Verify EIP-712 signature:{' '}
              <span className="font-mono">recover(M.signature, h) == c</span>.
            </li>
            <li>
              Verify each referenced CID: fetch the content, compute its CID, and compare to the
              manifest&apos;s claim.
            </li>
          </ol>
          <p>
            A complete verification requires one contract call (step 2), one signature recovery
            (step 5), and one hash-check per referenced CID (step 6). For a typical video manifest
            with 342 HLS segments, this is 342 content hashes, one manifest hash, and one signature
            recovery — roughly 50 ms on consumer hardware.
          </p>
          <p>
            The light client does not need to trust any server or gateway. A malicious gateway can
            only cause the verification to fail (by serving wrong content); it cannot cause a wrong
            manifest to be accepted.
          </p>
        </div>
      </section>

      <section id="s12-economic-model" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§12</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Economic Model
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            The Persistence Pool operates on a conservation principle: over any epoch, the total
            compensation paid equals the total disbursement from the pool balance. The pool is
            replenished by a fraction of creator-directed credit flows (the <em>credit pulse</em>)
            and, during bootstrap, by Aevia LLC directly.
          </p>
          <p>
            Let <span className="font-mono">S(t)</span> be the pool balance at epoch{' '}
            <span className="font-mono">t</span>, <span className="font-mono">I(t)</span> the
            incoming credit-pulse fraction, and <span className="font-mono">O(t)</span> the
            disbursement. The balance evolves as:
          </p>
        </div>
        <div className="mt-8 flex justify-center py-6">
          <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent">
            S(t+1) = (1 − ε) · S(t) + I(t)
          </pre>
        </div>
        <div className="mt-4 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            For a steady-state equilibrium <span className="font-mono">S*</span>, we require{' '}
            <span className="font-mono">O(t) = I(t)</span>, giving{' '}
            <span className="font-mono">S* = I / ε</span>.
          </p>
          <p>
            This has a useful consequence. The per-epoch rate{' '}
            <span className="font-mono">ρ(t)</span> is{' '}
            <span className="font-mono">ε · S(t) / Σ_i (R_i · B_i · W_region)</span>. At
            equilibrium,
          </p>
        </div>
        <div className="mt-6 flex justify-center py-6">
          <pre className="overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent">
            ρ* = I / Σ_i (R_i · B_i · W_region)
          </pre>
        </div>
        <div className="mt-4 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            The rate scales linearly with creator credit flow and inversely with replicated volume.
            As more creators send credit through the pulse, rates rise; as more provider nodes join,
            rates fall. The market is self-equilibrating.
          </p>
          <p>
            Break-even for a provider node depends on operating cost per byte-hour and on expected{' '}
            <span className="font-mono">R · B · W</span>. Consider a node in a high-weight region (
            <span className="font-mono">W = 1.5</span>) with 99% uptime (
            <span className="font-mono">R = 0.99</span>), holding 10 TB for a month (
            <span className="font-mono">B ≈ 7.2 · 10^15</span> byte-hours). The node earns{' '}
            <span className="font-mono">0.99 · 7.2·10^15 · 1.5 · ρ</span> cUSDC. With{' '}
            <span className="font-mono">ρ</span> set such that the steady-state rate yields
            approximately $5 per TB-month for high-weight regions, the node earns roughly $75/month
            for the 10 TB. Operating cost for the same 10 TB on consumer infrastructure —
            electricity, bandwidth, hardware amortization — is typically $15–30/month. The margin is
            real but modest.
          </p>
          <p>
            The model does not rely on speculative appreciation. Compensation is denominated in a
            fiat-pegged stablecoin; a provider&apos;s return is determined by their replication
            performance, not by token-price movements. This is an intentional contrast with designs
            that depend on native-token appreciation to make the economic loop close.
          </p>
        </div>
      </section>

      <section id="s13-related-work" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§13</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Related Work
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>Aevia draws on several prior systems, each of which solves a subset of the problem.</p>
          <p>
            <strong>IPFS</strong> [3] introduced content-addressed storage and the Kademlia DHT for
            decentralized retrieval. IPFS does not specify an economic incentive for persistence;
            content disappears when the last pinning node drops it.
          </p>
          <p>
            <strong>Filecoin</strong> [4] built an economic layer on IPFS, using proof-of-spacetime
            and proof-of-replication to compensate storage miners. Filecoin&apos;s design targets
            cold archival: deals are typically 6–12 months with large sector sizes and high
            retrieval latency. Aevia&apos;s persistence layer is shorter-horizon and
            retrieval-first, and operates on Base rather than on a bespoke chain.
          </p>
          <p>
            <strong>Arweave</strong> [5] uses a different model: a one-time perpetual payment into
            an endowment that compounds and funds indefinite replication. Arweave is optimized for
            permanent archival, accepts higher up-front cost, and does not separate persistence from
            distribution.
          </p>
          <p>
            <strong>Livepeer</strong> [10] addresses a different problem — transcoding at scale —
            using a similar provider-node and payment structure but focused on video processing
            rather than storage.
          </p>
          <p>
            <strong>LBRY/Odysee</strong>, <strong>PeerTube</strong>, and <strong>Rumble</strong>{' '}
            address video distribution without a protocol-level guarantee of persistence: their
            content can be de-platformed by the operator of the federated instance or the
            centralized service. Aevia&apos;s persistence layer is intended to outlive any
            individual client.
          </p>
          <p>
            <strong>BitTorrent</strong> demonstrated that distributed replication is viable at scale
            when aligned with user incentive. Aevia generalizes the pattern by making the incentive
            explicit (cUSDC compensation) rather than implicit (tit-for-tat choking).
          </p>
          <p>
            What Aevia contributes on top of these is the <em>separation principle</em>: persistence
            and distribution as distinct economic and governance layers. The Content Registry
            anchors persistence; the Risk Score and Council govern distribution. Existing systems
            either collapse the two (mainstream video platforms) or address only one of them (pure
            storage protocols).
          </p>
        </div>
      </section>

      <section id="s14-conclusion" className="py-16">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">§14</span>
        <h2 className="mt-2 font-headline text-5xl font-bold leading-tight tracking-tight">
          Conclusion
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-[1.7]">
          <p>
            We have described a protocol in which a creator&apos;s content persists in a network of
            economically compensated replicators, indexed by a public on-chain registry, and signed
            with a verifiable cryptographic identity. Distribution — ranking, feed surfacing,
            subsidy — is governed by a public, contestable risk score and a twelve-seat Ecumenical
            Council.
          </p>
          <p>
            The architecture takes a position: persistence is infrastructure and should be neutral;
            distribution is editorial and should be honest. We do not claim neutrality about what we
            recommend. We do claim that the continued existence of a creator&apos;s work is not, and
            should not be, conditional on our recommendation.
          </p>
          <p>
            The protocol is open-source: Apache-2.0 for the contracts and the specification;
            AGPL-3.0 for reference clients; MIT for the shared design system. The Content Registry
            address on Base is public. The Council&apos;s deliberations are on the public Trust
            Ledger. Every claim in this paper is verifiable in code.
          </p>
        </div>
      </section>

      <div id="references" className="border-t border-primary-dim/30 pt-12">
        <span className="font-label text-xs tracking-[0.04em] text-tertiary">references</span>
        <ol className="mt-6 list-decimal space-y-3 pl-6 font-mono text-sm text-on-surface-variant leading-[1.6]">
          <li>
            IETF RFC 2119 — Bradner, S., &ldquo;Key words for use in RFCs to Indicate Requirement
            Levels&rdquo;, March 1997.
          </li>
          <li>
            IETF RFC 8785 — Rundgren, A. et al., &ldquo;JSON Canonicalization Scheme (JCS)&rdquo;,
            June 2020.
          </li>
          <li>
            Benet, J., &ldquo;IPFS — Content Addressed, Versioned, P2P File System&rdquo;, 2014.
          </li>
          <li>Protocol Labs, &ldquo;Filecoin: A Decentralized Storage Network&rdquo;, 2017.</li>
          <li>
            Williams, S., &ldquo;Arweave: A Protocol for Economically Sustainable Information
            Permanence&rdquo;, 2018.
          </li>
          <li>
            Ethereum Foundation, &ldquo;EIP-712: Typed structured data hashing and signing&rdquo;,
            2018.
          </li>
          <li>
            Ethereum Foundation, &ldquo;EIP-55: Mixed-case checksum address encoding&rdquo;, 2016.
          </li>
          <li>Nakamoto, S., &ldquo;Bitcoin: A Peer-to-Peer Electronic Cash System&rdquo;, 2008.</li>
          <li>
            Maymounkov, P., Mazières, D., &ldquo;Kademlia: A Peer-to-peer Information System Based
            on the XOR Metric&rdquo;, 2002.
          </li>
          <li>Livepeer Inc., &ldquo;Livepeer Whitepaper&rdquo;, 2017.</li>
          <li>17 U.S.C. §512 — Limitations on liability relating to material online (DMCA).</li>
          <li>Regulation (EU) 2022/2065 — Digital Services Act.</li>
          <li>
            47 U.S.C. §230 — Protection for private blocking and screening of offensive material.
          </li>
          <li>18 U.S.C. §2258A — Reporting requirements of providers.</li>
          <li>SEC v. W.J. Howey Co., 328 U.S. 293 (1946).</li>
        </ol>
      </div>
    </>
  );
}
