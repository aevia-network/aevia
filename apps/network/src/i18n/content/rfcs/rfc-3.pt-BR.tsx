import type { RFCContent } from './types';

export const rfc3PtBR: RFCContent = {
  toc: [
    { id: 's1-escopo', label: '§1 · escopo' },
    { id: 's2-chaves', label: '§2 · material de chave' },
    { id: 's3-dominio', label: '§3 · domain separator EIP-712' },
    { id: 's4-typed-data', label: '§4 · typed data structure' },
    { id: 's5-assinatura', label: '§5 · construção da assinatura' },
    { id: 's6-verificacao', label: '§6 · verificação' },
    { id: 's7-privy', label: '§7 · integração Privy' },
    { id: 's8-seguranca', label: '§8 · considerações de segurança' },
    { id: 's9-referencias', label: '§9 · referências' },
  ],
  Body() {
    return (
      <>
        <section id="s1-escopo" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§1</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            escopo
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Este documento define como criadores autenticam manifestos no protocolo Aevia e como
              verificadores os validam. A autenticação usa EIP-712 typed-data signing sobre o hash
              canônico do manifesto (RFC-1). A chave de assinatura é uma chave privada Ethereum
              secp256k1 operada pelo criador diretamente ou via Privy embedded wallet.
            </p>
            <p>MUST, SHOULD, MAY seguem RFC 2119.</p>
          </div>
        </section>

        <section id="s2-chaves" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            material de chave
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>curva: secp256k1 (mesma do Ethereum).</li>
              <li>
                formato de chave pública: endereço Ethereum EIP-55 (20 bytes, checksum casing).
              </li>
              <li>
                formato de assinatura: compacto{' '}
                <span className="font-mono">
                  0x{'{'}r{'}'}
                  {'{'}s{'}'}
                  {'{'}v{'}'}
                </span>
                , 65 bytes totais (32+32+1), com{' '}
                <span className="font-mono">
                  v ∈ {'{'}27, 28{'}'}
                </span>
                .
              </li>
              <li>
                criadores MAY possuir a chave privada diretamente (software wallet, hardware wallet)
                ou delegar via Privy (§7).
              </li>
            </ul>
          </div>
        </section>

        <section id="s3-dominio" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            domain separator EIP-712
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>O domínio EIP-712 da Aevia é fixo:</p>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-surface-lowest p-6 font-mono text-sm text-on-surface-variant max-w-[72ch]">
            <code>{`{
  "name": "Aevia",
  "version": "1",
  "chainId": <chain ID da rede>,
  "verifyingContract": <endereço do ContentRegistry na chain>
}`}</code>
          </pre>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              <span className="font-mono text-primary">chainId</span> MUST ser o chain ID da rede
              alvo (Base Sepolia = 84532, Base Mainnet = 8453).{' '}
              <span className="font-mono text-primary">verifyingContract</span> MUST ser o endereço
              do Content Registry deployado naquela chain.
            </p>
            <p>
              O domain separator MUST ser incluído no digest EIP-712. Manifestos assinados com
              domínio errado MUST ser rejeitados.
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
              O tipo primário assinado é <span className="font-mono text-primary">Manifest</span>:
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
                <span className="font-mono text-primary">manifestHash</span> = SHA-256 da canonical
                encoding do manifesto com campos <span className="font-mono">cid</span> e{' '}
                <span className="font-mono">signature</span> removidos (RFC-1 §5).
              </li>
              <li>
                <span className="font-mono text-primary">creator</span> = endereço do signer (MUST
                coincidir com <span className="font-mono">manifest.creator</span>).
              </li>
              <li>
                <span className="font-mono text-primary">createdAt</span> = timestamp Unix em
                segundos (MUST coincidir com parse de{' '}
                <span className="font-mono">manifest.created_at</span>).
              </li>
            </ul>
          </div>
        </section>

        <section id="s5-assinatura" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            construção da assinatura
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>Para produzir a assinatura, o criador:</p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant">
              <li>
                computa <span className="font-mono">manifestHash</span> conforme RFC-1 §5;
              </li>
              <li>
                constrói a struct <span className="font-mono">Manifest</span> (§4);
              </li>
              <li>
                computa{' '}
                <span className="font-mono">domainSeparator = hashStruct(EIP712Domain)</span>
                {';'}
              </li>
              <li>
                computa{' '}
                <span className="font-mono">
                  digest = keccak256(0x1901 || domainSeparator || hashStruct(Manifest))
                </span>
                ;
              </li>
              <li>
                assina com secp256k1:{' '}
                <span className="font-mono">signature = sign(privateKey, digest)</span>.
              </li>
            </ol>
            <p>
              A assinatura resultante MUST ser colocada no campo{' '}
              <span className="font-mono">manifest.signature</span> em forma hex-encoded com prefixo{' '}
              <span className="font-mono">0x</span>.
            </p>
          </div>
        </section>

        <section id="s6-verificacao" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            verificação
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Verificação é <em>determinística e offline</em>. Dado um manifesto{' '}
              <span className="font-mono">M</span>, um verificador MUST:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant">
              <li>
                extrair <span className="font-mono">M.signature</span>
                {';'}
              </li>
              <li>
                computar <span className="font-mono">manifestHash</span> (RFC-1 §5);
              </li>
              <li>
                reconstruir o <span className="font-mono">digest</span> EIP-712 (§5.4);
              </li>
              <li>
                recuperar o signer:{' '}
                <span className="font-mono">recovered = ecrecover(digest, M.signature)</span>
                {';'}
              </li>
              <li>
                verificar que <span className="font-mono">recovered == M.creator</span>
                {';'}
              </li>
              <li>
                (quando relevante) verificar que <span className="font-mono">createdAt</span>{' '}
                typed-data coincide com parse de <span className="font-mono">M.created_at</span>.
              </li>
            </ol>
            <p>
              Qualquer mismatch MUST resultar em rejeição. Nenhum round-trip de rede é requerido.
            </p>
          </div>
        </section>

        <section id="s7-privy" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            integração Privy
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Privy embedded wallet opera como custody-layer delegada: o usuário autentica via
              email/social login, Privy gera e custodia secp256k1 keys em MPC e expõe uma API de
              assinatura. Do ponto de vista do protocolo Aevia, a chave Privy é indistinguível de
              uma chave software local — o endereço resultante é registrado normalmente no Content
              Registry e a assinatura EIP-712 é válida pela §6.
            </p>
            <p>
              Clientes que usam Privy MUST solicitar assinatura typed-data via{' '}
              <span className="font-mono">signTypedData</span>, não{' '}
              <span className="font-mono">personal_sign</span>. Clientes SHOULD mostrar ao usuário
              os campos typed-data antes da confirmação, para conformidade com boas práticas
              EIP-712.
            </p>
          </div>
        </section>

        <section id="s8-seguranca" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§8</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            considerações de segurança
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                replay entre chains: domain separator inclui{' '}
                <span className="font-mono">chainId</span> e{' '}
                <span className="font-mono">verifyingContract</span>, impedindo reuso de assinaturas
                entre Base Sepolia e Mainnet.
              </li>
              <li>
                malleability secp256k1: verificadores MUST usar ECDSA com s-value baixo (EIP-2) para
                evitar assinaturas maleáveis equivalentes.
              </li>
              <li>
                key loss: perda de acesso à wallet significa perda de capacidade de assinar{' '}
                <em>futuros</em> manifestos. Manifestos prévios permanecem válidos pois a assinatura
                já está no Registry.
              </li>
              <li>
                Privy social recovery: Privy MAY rotacionar chaves via social recovery; cada rotação
                produz novo endereço, que MUST ser explicitamente reconhecido como identidade do
                mesmo criador via assinatura cruzada.
              </li>
            </ul>
          </div>
        </section>

        <section id="s9-referencias" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§9</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            referências
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
