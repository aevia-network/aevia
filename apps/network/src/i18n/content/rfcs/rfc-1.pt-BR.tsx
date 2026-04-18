import type { RFCContent } from './types';

export const rfc1PtBR: RFCContent = {
  toc: [
    { id: 's1-escopo', label: '§1 · escopo' },
    { id: 's2-terminologia', label: '§2 · terminologia' },
    { id: 's3-schema', label: '§3 · schema canônico' },
    { id: 's4-tipos', label: '§4 · tipos de conteúdo' },
    { id: 's5-canonicalizacao', label: '§5 · canonicalização' },
    { id: 's6-versionamento', label: '§6 · versionamento' },
    { id: 's7-seguranca', label: '§7 · considerações de segurança' },
    { id: 's8-referencias', label: '§8 · referências' },
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
              Este documento define o schema canônico de <em>manifestos</em> do protocolo Aevia.
              Todo cliente criador MUST produzir manifestos que validam contra o schema de §3. Todo
              verificador MUST rejeitar manifestos que violam §3 ou §5.
            </p>
            <p>As palavras-chave MUST, SHOULD, MAY seguem RFC 2119.</p>
          </div>
        </section>

        <section id="s2-terminologia" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            terminologia
          </h2>
          <div className="mt-6 text-lg leading-[1.7] max-w-[72ch]">
            <dl className="space-y-3 text-on-surface-variant">
              <div>
                <dt className="font-mono text-sm text-primary">manifest</dt>
                <dd className="mt-1">documento JSON assinado que enumera um item de conteúdo.</dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">canonical encoding</dt>
                <dd className="mt-1">
                  representação byte-determinística do manifesto, conforme RFC 8785 (JCS).
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">manifest hash</dt>
                <dd className="mt-1">
                  SHA-256 da canonical encoding do manifesto com o campo{' '}
                  <span className="font-mono">signature</span> removido.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="s3-schema" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            schema canônico
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>O manifesto MUST obedecer o schema JSON abaixo:</p>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-surface-lowest p-6 font-mono text-sm text-on-surface-variant max-w-[72ch]">
            <code>{`{
  "version": 1,
  "cid": "<string — CID do corpo do manifesto>",
  "creator": "<string — endereço Ethereum EIP-55>",
  "created_at": "<string — timestamp RFC 3339 UTC>",
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
            <p>Regras de presença (MUST):</p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono text-primary">version</span> MUST ser inteiro igual a 1
                para este RFC.
              </li>
              <li>
                <span className="font-mono text-primary">cid</span> MUST ser o CID do manifesto
                canonicalmente codificado excluindo o próprio campo{' '}
                <span className="font-mono">cid</span> e o campo{' '}
                <span className="font-mono">signature</span>.
              </li>
              <li>
                <span className="font-mono text-primary">creator</span> MUST ser endereço EIP-55
                válido.
              </li>
              <li>
                <span className="font-mono text-primary">created_at</span> MUST ser timestamp RFC
                3339 em UTC com sufixo <span className="font-mono">Z</span>.
              </li>
              <li>
                exatamente um dos campos estruturais (<span className="font-mono">hls</span>,{' '}
                <span className="font-mono">image</span>,{' '}
                <span className="font-mono">document</span>) MUST ser não-nulo, correspondendo ao{' '}
                <span className="font-mono">content_type</span> declarado.
              </li>
              <li>
                <span className="font-mono text-primary">signature</span> MUST ser assinatura
                secp256k1 EIP-712 conforme RFC-3.
              </li>
            </ul>
          </div>
        </section>

        <section id="s4-tipos" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            tipos de conteúdo
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono text-primary">video/hls</span> — manifesto aponta para
                master playlist HLS e enumera segmentos. Cada segmento MUST ter CID próprio.
              </li>
              <li>
                <span className="font-mono text-primary">video/vod</span> — alias de{' '}
                <span className="font-mono">video/hls</span> com indicação de que o conteúdo não é
                ao vivo.
              </li>
              <li>
                <span className="font-mono text-primary">image</span> — campo{' '}
                <span className="font-mono">image</span> MUST ser preenchido. Formatos aceitos: png,
                jpeg, webp, avif.
              </li>
              <li>
                <span className="font-mono text-primary">document</span> — campo{' '}
                <span className="font-mono">document</span> MUST ser preenchido. Pode ser pdf,
                markdown ou html.
              </li>
            </ul>
            <p>
              Clientes SHOULD rejeitar content types desconhecidos. Clientes MAY sinalizar conteúdo
              de tipo não suportado como não-renderizável sem invalidar o manifesto.
            </p>
          </div>
        </section>

        <section id="s5-canonicalizacao" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            canonicalização
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Para garantir que duas partes produzam o mesmo hash sobre o mesmo manifesto, a
              canonicalização MUST seguir RFC 8785 (JSON Canonicalization Scheme — JCS):
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant">
              <li>chaves de objeto ordenadas lexicograficamente em UTF-16 code units;</li>
              <li>nenhum whitespace entre tokens;</li>
              <li>
                números em forma canônica (sem zeros à esquerda, sem sinal{' '}
                <span className="font-mono">+</span> explícito);
              </li>
              <li>strings em UTF-8, com apenas os escapes obrigatórios por RFC 8259;</li>
              <li>
                antes do hash: campos <span className="font-mono">cid</span> e{' '}
                <span className="font-mono">signature</span> REMOVIDOS;
              </li>
              <li>hash: SHA-256 da sequência de bytes UTF-8 canônica resultante.</li>
            </ol>
          </div>
        </section>

        <section id="s6-versionamento" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            versionamento
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Manifestos são imutáveis por CID. Uma revisão produz um novo manifesto com novo CID,
              novo timestamp e (tipicamente) novo <span className="font-mono">signature</span>. O
              Content Registry MUST preservar ambos. Clientes SHOULD resolver para o manifesto mais
              recente publicado pelo mesmo <span className="font-mono">creator</span> no slot lógico
              de conteúdo, quando referido pelo slot.
            </p>
            <p>
              Incrementos no campo <span className="font-mono text-primary">version</span> deste RFC
              serão propostos via Conselho (RFC-7) e MUST manter retrocompatibilidade para
              verificadores: um manifesto <span className="font-mono">version=1</span> MUST
              continuar verificável mesmo após a publicação de{' '}
              <span className="font-mono">version=2</span>.
            </p>
          </div>
        </section>

        <section id="s7-seguranca" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            considerações de segurança
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                ordenação não-canônica de campos produz hashes divergentes e invalida a assinatura;
                verificadores MUST canonicalizar antes de verificar.
              </li>
              <li>
                timestamps futuros além de{' '}
                <span className="font-mono">registeredAt + 5 minutos</span> DEVEM ser tratados como
                suspeitos pelos clientes.
              </li>
              <li>
                campos extensão desconhecidos MUST ser preservados byte-a-byte por proxies e
                relayers; descartar campos invalida a assinatura.
              </li>
            </ul>
          </div>
        </section>

        <section id="s8-referencias" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§8</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            referências
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
