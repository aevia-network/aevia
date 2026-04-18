import type { RFCContent } from './types';

export const rfc1En: RFCContent = {
  toc: [
    { id: 's1-escopo', label: '§1 · scope' },
    { id: 's2-terminologia', label: '§2 · terminology' },
    { id: 's3-schema', label: '§3 · canonical schema' },
    { id: 's4-tipos', label: '§4 · content types' },
    { id: 's5-canonicalizacao', label: '§5 · canonicalization' },
    { id: 's6-versionamento', label: '§6 · versioning' },
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
              This document defines the canonical schema of Aevia protocol <em>manifests</em>. Every
              creator client MUST produce manifests that validate against the §3 schema. Every
              verifier MUST reject manifests that violate §3 or §5.
            </p>
            <p>MUST, SHOULD, MAY follow RFC 2119.</p>
          </div>
        </section>

        <section id="s2-terminologia" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            terminology
          </h2>
          <div className="mt-6 text-lg leading-[1.7] max-w-[72ch]">
            <dl className="space-y-3 text-on-surface-variant">
              <div>
                <dt className="font-mono text-sm text-primary">manifest</dt>
                <dd className="mt-1">signed JSON document enumerating a content item.</dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">canonical encoding</dt>
                <dd className="mt-1">
                  byte-deterministic representation of the manifest, per RFC 8785 (JCS).
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">manifest hash</dt>
                <dd className="mt-1">
                  SHA-256 of the canonical encoding of the manifest with the{' '}
                  <span className="font-mono">signature</span> field removed.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="s3-schema" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            canonical schema
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>The manifest MUST conform to the JSON schema below:</p>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-surface-lowest p-6 font-mono text-sm text-on-surface-variant max-w-[72ch]">
            <code>{`{
  "version": 1,
  "cid": "<string — CID of the manifest body>",
  "creator": "<string — EIP-55 Ethereum address>",
  "created_at": "<string — RFC 3339 UTC timestamp>",
  "content_type": "video/hls" | "video/vod" | "image" | "document",
  "duration_seconds": <number | null>,
  "hls": {
    "master_playlist_cid": "<string — CID>",
    "segments": ["<CID>", ...]
  } | null,
  "image": { "cid": "<CID>", "width": <number>, "height": <number> } | null,
  "document": { "cid": "<CID>", "mime": "<string>" } | null,
  "title": "<string | null>",
  "description": "<string | null>",
  "tags": ["<string>", ...] | null,
  "signature": "<string — 0x-prefixed 65-byte secp256k1>"
}`}</code>
          </pre>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>Presence rules (MUST):</p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono text-primary">version</span> MUST be integer{' '}
                <span className="font-mono">1</span> for this RFC.
              </li>
              <li>
                <span className="font-mono text-primary">cid</span> MUST be the CID of the
                canonically encoded manifest excluding the <span className="font-mono">cid</span>{' '}
                and <span className="font-mono">signature</span> fields themselves.
              </li>
              <li>
                <span className="font-mono text-primary">creator</span> MUST be a valid EIP-55
                address.
              </li>
              <li>
                <span className="font-mono text-primary">created_at</span> MUST be an RFC 3339 UTC
                timestamp with <span className="font-mono">Z</span> suffix.
              </li>
              <li>
                exactly one of <span className="font-mono">hls</span>,{' '}
                <span className="font-mono">image</span>,{' '}
                <span className="font-mono">document</span> MUST be non-null, matching the declared{' '}
                <span className="font-mono">content_type</span>.
              </li>
              <li>
                <span className="font-mono text-primary">signature</span> MUST be a secp256k1
                EIP-712 signature per RFC-3.
              </li>
            </ul>
          </div>
        </section>

        <section id="s4-tipos" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            content types
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono text-primary">video/hls</span> — manifest points to an
                HLS master playlist and enumerates segments. Each segment MUST have its own CID.
              </li>
              <li>
                <span className="font-mono text-primary">video/vod</span> — alias of{' '}
                <span className="font-mono">video/hls</span> for non-live content.
              </li>
              <li>
                <span className="font-mono text-primary">image</span> —{' '}
                <span className="font-mono">image</span> field MUST be populated. Accepted formats:
                png, jpeg, webp, avif.
              </li>
              <li>
                <span className="font-mono text-primary">document</span> —{' '}
                <span className="font-mono">document</span> field MUST be populated. MAY be pdf,
                markdown, or html.
              </li>
            </ul>
            <p>
              Clients SHOULD reject unknown content types. Clients MAY surface unsupported content
              as non-renderable without invalidating the manifest.
            </p>
          </div>
        </section>

        <section id="s5-canonicalizacao" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            canonicalization
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              To guarantee that two parties produce the same hash over the same manifest,
              canonicalization MUST follow RFC 8785 (JSON Canonicalization Scheme — JCS):
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant">
              <li>object keys sorted lexicographically by UTF-16 code units;</li>
              <li>no whitespace between tokens;</li>
              <li>
                numbers in canonical form (no leading zeros, no explicit{' '}
                <span className="font-mono">+</span> sign);
              </li>
              <li>UTF-8 strings with only the escapes required by RFC 8259;</li>
              <li>
                before hashing: <span className="font-mono">cid</span> and{' '}
                <span className="font-mono">signature</span> fields REMOVED;
              </li>
              <li>hash: SHA-256 over the resulting canonical UTF-8 byte sequence.</li>
            </ol>
          </div>
        </section>

        <section id="s6-versionamento" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            versioning
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Manifests are immutable by CID. A revision produces a new manifest with a new CID, a
              new timestamp, and (typically) a new <span className="font-mono">signature</span>. The
              Content Registry MUST preserve both. Clients SHOULD resolve to the latest manifest
              published by the same <span className="font-mono">creator</span> in the logical
              content slot when referenced by slot.
            </p>
            <p>
              Bumps to the <span className="font-mono text-primary">version</span> field of this RFC
              will be proposed via Council (RFC-7) and MUST preserve backward compatibility for
              verifiers: a <span className="font-mono">version=1</span> manifest MUST remain
              verifiable after <span className="font-mono">version=2</span> is published.
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
                non-canonical field ordering produces divergent hashes and invalidates the
                signature; verifiers MUST canonicalize before verifying.
              </li>
              <li>
                future timestamps beyond <span className="font-mono">registeredAt + 5 minutes</span>{' '}
                SHOULD be treated as suspicious by clients.
              </li>
              <li>
                unknown extension fields MUST be preserved byte-for-byte by proxies and relayers;
                dropping fields invalidates the signature.
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
              <li>IETF RFC 8259 — JSON</li>
              <li>IETF RFC 8785 — JSON Canonicalization Scheme</li>
              <li>IETF RFC 3339 — Date and Time on the Internet</li>
              <li>EIP-55 — Mixed-case checksum address encoding</li>
              <li>RFC-2 — Content Addressing</li>
              <li>RFC-3 — Authentication and Signature</li>
            </ol>
          </div>
        </section>
      </>
    );
  },
};
