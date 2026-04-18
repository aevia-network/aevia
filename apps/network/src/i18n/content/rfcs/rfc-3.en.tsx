import type { RFCContent } from './types';

export const rfc3En: RFCContent = {
  toc: [
    { id: 's1-escopo', label: '§1 · scope' },
    { id: 's2-chaves', label: '§2 · key material' },
    { id: 's3-dominio', label: '§3 · EIP-712 domain separator' },
    { id: 's4-typed-data', label: '§4 · typed data structure' },
    { id: 's5-assinatura', label: '§5 · signature construction' },
    { id: 's6-verificacao', label: '§6 · verification' },
    { id: 's7-privy', label: '§7 · Privy integration' },
    { id: 's8-seguranca', label: '§8 · security considerations' },
    { id: 's9-referencias', label: '§9 · references' },
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
              This document defines how creators authenticate manifests in the Aevia protocol and
              how verifiers validate them. Authentication uses EIP-712 typed-data signing over the
              canonical hash of the manifest (RFC-1). The signing key is an Ethereum secp256k1
              private key operated directly by the creator or via a Privy embedded wallet.
            </p>
            <p>MUST, SHOULD, MAY follow RFC 2119.</p>
          </div>
        </section>

        <section id="s2-chaves" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            key material
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>curve: secp256k1 (same as Ethereum).</li>
              <li>public key format: EIP-55 Ethereum address (20 bytes, checksum casing).</li>
              <li>
                signature format: compact{' '}
                <span className="font-mono">
                  0x{'{'}r{'}'}
                  {'{'}s{'}'}
                  {'{'}v{'}'}
                </span>
                , 65 total bytes (32+32+1), with{' '}
                <span className="font-mono">
                  v ∈ {'{'}27, 28{'}'}
                </span>
                .
              </li>
              <li>
                creators MAY hold the private key directly (software wallet, hardware wallet) or
                delegate via Privy (§7).
              </li>
            </ul>
          </div>
        </section>

        <section id="s3-dominio" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            EIP-712 domain separator
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>The Aevia EIP-712 domain is fixed:</p>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-surface-lowest p-6 font-mono text-sm text-on-surface-variant max-w-[72ch]">
            <code>{`{
  "name": "Aevia",
  "version": "1",
  "chainId": <chain ID of the target network>,
  "verifyingContract": <ContentRegistry address on that chain>
}`}</code>
          </pre>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              <span className="font-mono text-primary">chainId</span> MUST be the chain ID of the
              target network (Base Sepolia = 84532, Base Mainnet = 8453).{' '}
              <span className="font-mono text-primary">verifyingContract</span> MUST be the Content
              Registry address deployed on that chain.
            </p>
            <p>
              The domain separator MUST be included in the EIP-712 digest. Manifests signed with the
              wrong domain MUST be rejected.
            </p>
          </div>
        </section>

        <section id="s4-typed-data" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            typed data structure
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              The primary signed type is <span className="font-mono text-primary">Manifest</span>:
            </p>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-surface-lowest p-6 font-mono text-sm text-on-surface-variant max-w-[72ch]">
            <code>{`Manifest(
  bytes32 manifestHash,
  address creator,
  uint64 createdAt
)`}</code>
          </pre>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono text-primary">manifestHash</span> = SHA-256 of the
                canonical encoding of the manifest with <span className="font-mono">cid</span> and{' '}
                <span className="font-mono">signature</span> fields removed (RFC-1 §5).
              </li>
              <li>
                <span className="font-mono text-primary">creator</span> = signer address (MUST match{' '}
                <span className="font-mono">manifest.creator</span>).
              </li>
              <li>
                <span className="font-mono text-primary">createdAt</span> = Unix timestamp in
                seconds (MUST match parse of <span className="font-mono">manifest.created_at</span>
                ).
              </li>
            </ul>
          </div>
        </section>

        <section id="s5-assinatura" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            signature construction
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>To produce the signature, the creator:</p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant">
              <li>
                computes <span className="font-mono">manifestHash</span> per RFC-1 §5;
              </li>
              <li>
                builds the <span className="font-mono">Manifest</span> struct (§4);
              </li>
              <li>
                computes{' '}
                <span className="font-mono">domainSeparator = hashStruct(EIP712Domain)</span>
                {';'}
              </li>
              <li>
                computes{' '}
                <span className="font-mono">
                  digest = keccak256(0x1901 || domainSeparator || hashStruct(Manifest))
                </span>
                ;
              </li>
              <li>
                signs with secp256k1:{' '}
                <span className="font-mono">signature = sign(privateKey, digest)</span>.
              </li>
            </ol>
            <p>
              The resulting signature MUST be placed in{' '}
              <span className="font-mono">manifest.signature</span> in hex-encoded form with the{' '}
              <span className="font-mono">0x</span> prefix.
            </p>
          </div>
        </section>

        <section id="s6-verificacao" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            verification
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Verification is <em>deterministic and offline</em>. Given a manifest{' '}
              <span className="font-mono">M</span>, a verifier MUST:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant">
              <li>
                extract <span className="font-mono">M.signature</span>
                {';'}
              </li>
              <li>
                compute <span className="font-mono">manifestHash</span> (RFC-1 §5);
              </li>
              <li>
                reconstruct the EIP-712 <span className="font-mono">digest</span> (§5.4);
              </li>
              <li>
                recover the signer:{' '}
                <span className="font-mono">recovered = ecrecover(digest, M.signature)</span>
                {';'}
              </li>
              <li>
                verify that <span className="font-mono">recovered == M.creator</span>
                {';'}
              </li>
              <li>
                (when relevant) verify that <span className="font-mono">createdAt</span> typed-data
                matches the parse of <span className="font-mono">M.created_at</span>.
              </li>
            </ol>
            <p>Any mismatch MUST result in rejection. No network round-trip is required.</p>
          </div>
        </section>

        <section id="s7-privy" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            Privy integration
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Privy embedded wallet operates as a delegated custody layer: the user authenticates
              via email/social login, Privy generates and custodies secp256k1 keys under MPC, and
              exposes a signing API. From the Aevia protocol perspective, a Privy key is
              indistinguishable from a local software key — the resulting address is registered in
              the Content Registry normally and the EIP-712 signature is valid under §6.
            </p>
            <p>
              Clients using Privy MUST request typed-data signing via{' '}
              <span className="font-mono">signTypedData</span>, not{' '}
              <span className="font-mono">personal_sign</span>. Clients SHOULD display the
              typed-data fields to the user before confirmation, per EIP-712 best practice.
            </p>
          </div>
        </section>

        <section id="s8-seguranca" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§8</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            security considerations
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                cross-chain replay: the domain separator includes{' '}
                <span className="font-mono">chainId</span> and{' '}
                <span className="font-mono">verifyingContract</span>, preventing signature reuse
                between Base Sepolia and Mainnet.
              </li>
              <li>
                secp256k1 malleability: verifiers MUST use low-s ECDSA (EIP-2) to avoid malleable
                equivalent signatures.
              </li>
              <li>
                key loss: loss of wallet access means loss of the ability to sign <em>future</em>{' '}
                manifests. Previous manifests remain valid since the signature is already in the
                Registry.
              </li>
              <li>
                Privy social recovery: Privy MAY rotate keys via social recovery; each rotation
                produces a new address, which MUST be explicitly acknowledged as the same creator
                identity via cross-signature.
              </li>
            </ul>
          </div>
        </section>

        <section id="s9-referencias" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§9</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            references
          </h2>
          <div className="mt-6 max-w-[72ch]">
            <ol className="list-decimal pl-6 font-mono text-sm text-on-surface-variant space-y-2">
              <li>IETF RFC 2119 — Key words for RFCs</li>
              <li>EIP-712 — Typed structured data hashing and signing</li>
              <li>EIP-55 — Mixed-case checksum address encoding</li>
              <li>EIP-2 — Homestead hard-fork (low-s signatures)</li>
              <li>RFC-1 — Manifest Schema</li>
              <li>RFC-2 — Content Addressing</li>
              <li>Privy Documentation</li>
            </ol>
          </div>
        </section>
      </>
    );
  },
};
