import type { RFCContent } from './types';

export const rfc2En: RFCContent = {
  toc: [
    { id: 's1-escopo', label: '§1 · scope' },
    { id: 's2-encoding', label: '§2 · CID encoding' },
    { id: 's3-codecs', label: '§3 · assigned codecs' },
    { id: 's4-verificacao', label: '§4 · verification' },
    { id: 's5-retrieval', label: '§5 · retrieval semantics' },
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
              This document defines how content is addressed in the Aevia protocol. Every canonical
              reference to bytes in the protocol MUST use a Content Identifier (CID) as specified
              here. Opaque URLs are NOT a canonical reference.
            </p>
            <p>MUST, SHOULD, MAY follow RFC 2119.</p>
          </div>
        </section>

        <section id="s2-encoding" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            CID encoding
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Aevia adopts CIDv1 as per Multiformats. For any object{' '}
              <span className="font-mono">O</span>, its CID is:
            </p>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent max-w-[72ch]">
            CID(O) = &quot;b&quot; || base32(codec || 0x12 || 0x20 || SHA-256(O))
          </pre>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>where:</p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                the <span className="font-mono">&quot;b&quot;</span> prefix identifies multibase
                base32 without padding per the Multibase spec;
              </li>
              <li>
                <span className="font-mono">codec</span> is the multicodec varint identifying the
                byte type (see §3);
              </li>
              <li>
                <span className="font-mono">0x12</span> is the multihash identifier for SHA-256;
              </li>
              <li>
                <span className="font-mono">0x20</span> is the digest length in bytes (32);
              </li>
              <li>
                <span className="font-mono">SHA-256(O)</span> is the SHA-256 digest of the object
                bytes.
              </li>
            </ul>
            <p>
              Implementations MUST reject CIDs that do not start with{' '}
              <span className="font-mono">&quot;b&quot;</span> or that use a multihash other than
              SHA-256 under this RFC.
            </p>
          </div>
        </section>

        <section id="s3-codecs" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            assigned codecs
          </h2>
          <div className="mt-6 text-lg leading-[1.7] max-w-[72ch]">
            <table className="w-full border-collapse font-mono text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    codec
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    value
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 text-xs tracking-[0.04em] text-tertiary">
                    use
                  </th>
                </tr>
              </thead>
              <tbody className="text-on-surface-variant">
                <tr className="border-b border-primary-dim/20">
                  <td className="py-3 pr-6 text-primary">raw</td>
                  <td className="py-3 pr-6">0x55</td>
                  <td className="py-3">opaque bytes — HLS segments, images, files</td>
                </tr>
                <tr className="border-b border-primary-dim/20">
                  <td className="py-3 pr-6 text-primary">json</td>
                  <td className="py-3 pr-6">0x0200</td>
                  <td className="py-3">manifests and structured JSON documents</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-on-surface-variant">
              Other codecs MAY be added via revision of this RFC. Implementations SHOULD preserve
              CIDs with unknown codecs at proxy routing, rejecting them only at the application
              layer.
            </p>
          </div>
        </section>

        <section id="s4-verificacao" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            verification
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Given a CID <span className="font-mono">x</span> and a byte sequence{' '}
              <span className="font-mono">O</span>, a verifier MUST:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant">
              <li>
                decode <span className="font-mono">x</span> extracting{' '}
                <span className="font-mono">(codec, digest_algo, digest_len, digest)</span>
                {';'}
              </li>
              <li>
                verify that <span className="font-mono">digest_algo == 0x12</span> (SHA-256){';'}
              </li>
              <li>
                verify that <span className="font-mono">digest_len == 0x20</span>
                {';'}
              </li>
              <li>
                compute <span className="font-mono">SHA-256(O)</span>
                {';'}
              </li>
              <li>compare the 32 bytes of the digest; accept only if identical.</li>
            </ol>
            <p>
              A mismatch at any step MUST result in rejecting the bytes. The client SHOULD try
              another peer, not re-request from the same peer with the same bytes.
            </p>
          </div>
        </section>

        <section id="s5-retrieval" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            retrieval semantics
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              CID retrieval is <em>location-independent</em>. Any node may satisfy the request; the
              protocol does not privilege any origin. Clients SHOULD:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                query <span className="font-mono">FindProviders(cid)</span> in the DHT to obtain the
                candidate peer set;
              </li>
              <li>
                request the bytes in parallel from multiple candidates, accepting the first response
                that passes §4;
              </li>
              <li>discard invalid responses with no retry against the same peer;</li>
              <li>
                cache the <span className="font-mono">(cid → bytes)</span> mapping locally for at
                least the session duration.
              </li>
            </ul>
            <p>
              Clients MAY use HTTP gateways as fallback when libp2p is unavailable. Gateways MUST
              return the exact bytes; clients MUST verify by CID even when fetching via gateway.
            </p>
          </div>
        </section>

        <section id="s6-seguranca" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            security considerations
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                SHA-256 is considered secure for content addressing over the horizon of this RFC.
                Transitions to SHA-3 or BLAKE3 MUST be preceded by a new revision.
              </li>
              <li>
                retrieval timing attack: returning &ldquo;I don’t have this CID&rdquo; may leak
                cache patterns. Provider nodes SHOULD respond in constant time to unknown CID
                requests.
              </li>
              <li>
                malicious HTTP gateways may return wrong bytes; §4 guarantees clients are not
                fooled, but gateways MAY be used for traffic analysis. Clients SHOULD rotate
                gateways.
              </li>
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
              <li>Multiformats CID v1 Spec</li>
              <li>Multihash Specification</li>
              <li>Multicodec Table</li>
              <li>Multibase Specification</li>
              <li>RFC-1 — Manifest Schema</li>
            </ol>
          </div>
        </section>
      </>
    );
  },
};
