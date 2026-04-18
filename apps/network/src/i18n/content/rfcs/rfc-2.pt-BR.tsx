import type { RFCContent } from './types';

export const rfc2PtBR: RFCContent = {
  toc: [
    { id: 's1-escopo', label: '§1 · escopo' },
    { id: 's2-encoding', label: '§2 · encoding de CID' },
    { id: 's3-codecs', label: '§3 · codecs atribuídos' },
    { id: 's4-verificacao', label: '§4 · verificação' },
    { id: 's5-retrieval', label: '§5 · semântica de retrieval' },
    { id: 's6-seguranca', label: '§6 · considerações de segurança' },
    { id: 's7-referencias', label: '§7 · referências' },
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
              Este documento define como conteúdo é endereçado no protocolo Aevia. Toda referência
              canônica a bytes no protocolo MUST usar um Content Identifier (CID) conforme
              especificado aqui. URLs opacas NÃO são referência canônica.
            </p>
            <p>MUST, SHOULD, MAY seguem RFC 2119.</p>
          </div>
        </section>

        <section id="s2-encoding" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            encoding de CID
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Aevia adota CIDv1 conforme Multiformats. Para qualquer objeto{' '}
              <span className="font-mono">O</span>, seu CID é:
            </p>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-lg bg-surface-lowest px-6 py-4 font-mono text-base text-accent max-w-[72ch]">
            CID(O) = &quot;b&quot; || base32(codec || 0x12 || 0x20 || SHA-256(O))
          </pre>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>onde:</p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                o prefixo <span className="font-mono">&quot;b&quot;</span> identifica multibase
                base32 sem padding conforme Multibase spec;
              </li>
              <li>
                <span className="font-mono">codec</span> é o multicodec varint identificando o tipo
                de bytes (ver §3);
              </li>
              <li>
                <span className="font-mono">0x12</span> é o multihash identifier para SHA-256;
              </li>
              <li>
                <span className="font-mono">0x20</span> é o comprimento do digest em bytes (32);
              </li>
              <li>
                <span className="font-mono">SHA-256(O)</span> é o digest SHA-256 dos bytes do
                objeto.
              </li>
            </ul>
            <p>
              Implementações MUST rejeitar CIDs que não começam com{' '}
              <span className="font-mono">&quot;b&quot;</span> ou que usam multihash diferente de
              SHA-256 neste RFC.
            </p>
          </div>
        </section>

        <section id="s3-codecs" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            codecs atribuídos
          </h2>
          <div className="mt-6 text-lg leading-[1.7] max-w-[72ch]">
            <table className="w-full border-collapse font-mono text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    codec
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 pr-6 text-xs tracking-[0.04em] text-tertiary">
                    valor
                  </th>
                  <th className="border-b border-primary-dim/40 pb-3 text-xs tracking-[0.04em] text-tertiary">
                    uso
                  </th>
                </tr>
              </thead>
              <tbody className="text-on-surface-variant">
                <tr className="border-b border-primary-dim/20">
                  <td className="py-3 pr-6 text-primary">raw</td>
                  <td className="py-3 pr-6">0x55</td>
                  <td className="py-3">bytes opacos — segmentos HLS, imagens, arquivos</td>
                </tr>
                <tr className="border-b border-primary-dim/20">
                  <td className="py-3 pr-6 text-primary">json</td>
                  <td className="py-3 pr-6">0x0200</td>
                  <td className="py-3">manifestos e documentos JSON estruturados</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-on-surface-variant">
              Outros codecs podem ser adicionados via revisão deste RFC. Implementações SHOULD
              preservar CIDs com codecs desconhecidos ao proxy-roteamento, rejeitando-os apenas na
              camada de aplicação.
            </p>
          </div>
        </section>

        <section id="s4-verificacao" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            verificação
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Dado um CID <span className="font-mono">x</span> e uma sequência de bytes{' '}
              <span className="font-mono">O</span>, um verificador MUST:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant">
              <li>
                decodificar <span className="font-mono">x</span> extraindo{' '}
                <span className="font-mono">(codec, digest_algo, digest_len, digest)</span>
                {';'}
              </li>
              <li>
                verificar que <span className="font-mono">digest_algo == 0x12</span> (SHA-256){';'}
              </li>
              <li>
                verificar que <span className="font-mono">digest_len == 0x20</span>
                {';'}
              </li>
              <li>
                computar <span className="font-mono">SHA-256(O)</span>
                {';'}
              </li>
              <li>comparar os 32 bytes do digest; aceitar apenas se idênticos.</li>
            </ol>
            <p>
              Um mismatch em qualquer passo MUST resultar em rejeição dos bytes. O cliente SHOULD
              tentar outro peer, não re-tentar o mesmo peer com os mesmos bytes.
            </p>
          </div>
        </section>

        <section id="s5-retrieval" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            semântica de retrieval
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Retrieval por CID é <em>location-independent</em>. Qualquer nó pode satisfazer o
              pedido; o protocolo não privilegia nenhuma origem. Clientes SHOULD:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                consultar <span className="font-mono">FindProviders(cid)</span> na DHT para obter o
                conjunto de peers candidatos;
              </li>
              <li>
                requisitar os bytes em paralelo a múltiplos candidatos, aceitando a primeira
                resposta que passa §4;
              </li>
              <li>descartar respostas inválidas sem retry ao mesmo peer;</li>
              <li>
                cachear localmente o mapeamento <span className="font-mono">(cid → bytes)</span>{' '}
                pelo menos pela duração da sessão.
              </li>
            </ul>
            <p>
              Clientes MAY usar gateways HTTP como fallback quando libp2p não estiver disponível.
              Gateways MUST retornar os bytes exatos; clientes MUST verificar por CID mesmo quando
              buscam via gateway.
            </p>
          </div>
        </section>

        <section id="s6-seguranca" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            considerações de segurança
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                SHA-256 é considerado seguro para content addressing pelo horizonte deste RFC.
                Transições para SHA-3 ou BLAKE3 MUST ser precedidas de nova revisão.
              </li>
              <li>
                timing attack via retrieval: retorno de &ldquo;não tenho esse CID&rdquo; pode vazar
                padrões de cache. Provider nodes SHOULD responder em tempo constante a pedidos de
                CID desconhecido.
              </li>
              <li>
                gateways HTTP maliciosos podem retornar bytes errados; §4 garante que clientes não
                são enganados, mas gateways MAY ser usados para análise de tráfego. Clientes SHOULD
                rotacionar gateways.
              </li>
            </ul>
          </div>
        </section>

        <section id="s7-referencias" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            referências
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
