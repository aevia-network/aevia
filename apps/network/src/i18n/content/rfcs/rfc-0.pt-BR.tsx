import type { RFCContent } from './types';

export const rfc0PtBR: RFCContent = {
  toc: [
    { id: 's1-escopo', label: '§1 · escopo' },
    { id: 's2-terminologia', label: '§2 · terminologia' },
    { id: 's3-arquitetura', label: '§3 · arquitetura em camadas' },
    { id: 's4-invariantes', label: '§4 · invariantes' },
    { id: 's5-documentos', label: '§5 · documentos normativos' },
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
              Este documento descreve o Protocolo Aevia em nível de visão geral. Define a tese, a
              arquitetura em camadas, e o conjunto de RFCs normativos que juntos constituem a
              especificação. Clientes e provider nodes que pretendem ser conformes MUST implementar
              os RFCs listados em §5 conforme aplicável ao seu papel.
            </p>
            <p>
              As palavras-chave <span className="font-mono text-primary not-italic">MUST</span>,{' '}
              <span className="font-mono text-primary not-italic">SHOULD</span> e{' '}
              <span className="font-mono text-primary not-italic">MAY</span> são interpretadas
              conforme RFC 2119.
            </p>
            <p>
              A tese do protocolo é: <em>persistência não implica distribuição</em>. O protocolo
              separa duas camadas historicamente colapsadas em plataformas comerciais: (i) a
              permanência dos bytes (persistência), e (ii) a decisão editorial de recomendar os
              bytes a uma audiência (distribuição). Esta separação é arquitetural e irreversível em
              nível de protocolo.
            </p>
          </div>
        </section>

        <section id="s2-terminologia" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            terminologia
          </h2>
          <div className="mt-6 text-lg leading-[1.7] max-w-[72ch]">
            <dl className="space-y-4">
              <div>
                <dt className="font-mono text-sm text-primary">manifest</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Documento JSON assinado que descreve um item de conteúdo. Normalizado por RFC-1.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">cid</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Content Identifier, derivado deterministicamente do SHA-256 do conteúdo.
                  Normalizado por RFC-2.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">provider node</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Processo que replica bytes, prova replicação on-chain e recebe compensação
                  fee-for-service.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">content registry</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Contrato Solidity em Base que ancora o hash de cada manifesto registrado com seu
                  timestamp de bloco.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">persistence pool</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Contrato Solidity que recebe cUSDC e desembolsa aos provider nodes segundo
                  métricas auditadas. Normalizado por RFC-5.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">risk score</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Função R(c) em [0,1] que determina elegibilidade de subsídio e surface em feed.
                  Normalizado por RFC-6 (em rascunho).
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sm text-primary">aup</dt>
                <dd className="mt-1 text-on-surface-variant">
                  Acceptable Use Policy. Conjunto de exclusões normativas que o protocolo não
                  subsidia nem indexa. Normalizado por RFC-4.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="s3-arquitetura" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            arquitetura em camadas
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              O protocolo é organizado em seis camadas. Uma implementação conforme MUST respeitar a
              ordem de responsabilidades abaixo:
            </p>
            <ol className="list-decimal pl-6 space-y-3 text-on-surface-variant">
              <li>
                <strong className="text-accent">endereçamento (RFC-2)</strong> — todo conteúdo é
                referenciado por CID. URLs opacas não constituem referência canônica.
              </li>
              <li>
                <strong className="text-accent">identidade (RFC-3)</strong> — toda autoria é provada
                por assinatura EIP-712 sobre o hash canônico do manifesto.
              </li>
              <li>
                <strong className="text-accent">persistência</strong> — Content Registry em Base L2
                ancora manifestos; provider nodes replicam os bytes referenciados e provam
                replicação em intervalos de challenge-response.
              </li>
              <li>
                <strong className="text-accent">rede</strong> — libp2p + DHT Kademlia para
                discovery; Circuit Relay v2 para peers atrás de NAT; WebTransport para viewers em
                browser.
              </li>
              <li>
                <strong className="text-accent">distribuição (RFC-6)</strong> — Risk Score governa
                feed, ranking e subsídio. A decisão de distribuição é sempre <em>secundária</em> à
                persistência.
              </li>
              <li>
                <strong className="text-accent">governança (RFC-7)</strong> — Conselho Ecumênico de
                12 assentos detém veto sobre parâmetros. Deliberações são ancoradas no Trust Ledger.
              </li>
            </ol>
          </div>
        </section>

        <section id="s4-invariantes" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            invariantes
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>O protocolo preserva os seguintes invariantes. Implementações conformes MUST:</p>
            <ul className="list-disc pl-6 space-y-3 text-on-surface-variant">
              <li>
                <strong className="text-accent">imutabilidade de CID</strong> — nenhum fluxo
                legítimo do protocolo altera os bytes associados a um CID. Toda revisão de conteúdo
                gera um novo manifesto com novos CIDs.
              </li>
              <li>
                <strong className="text-accent">append-only do Registry</strong> — manifestos
                registrados não são deletáveis. Revisões superpõem, não sobrescrevem.
              </li>
              <li>
                <strong className="text-accent">separação persistência/distribuição</strong> —
                nenhuma decisão editorial (Risk Score, feed, subsídio) altera a disponibilidade dos
                bytes. Um CID com R(c) alto permanece recuperável via DHT; apenas perde subsídio e
                ranking.
              </li>
              <li>
                <strong className="text-accent">verificabilidade offline</strong> — manifestos DEVEM
                ser verificáveis sem network round-trip adicional dado apenas o manifesto, seu CID
                declarado e o domain separator do protocolo.
              </li>
              <li>
                <strong className="text-accent">denominação em stablecoin</strong> — compensações de
                provider nodes SÃO denominadas em stablecoin atrelada ao dólar (cUSDC em Base). O
                protocolo não emite token nativo especulativo.
              </li>
            </ul>
          </div>
        </section>

        <section id="s5-documentos" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            documentos normativos
          </h2>
          <div className="mt-6 text-lg leading-[1.7] max-w-[72ch]">
            <p className="mb-6 text-on-surface-variant">
              A especificação completa é composta pelos seguintes RFCs. Implementações conformes ao
              papel indicado MUST implementar os RFCs marcados.
            </p>
            <ul className="list-none pl-0 space-y-3 font-mono text-sm">
              <li>
                <span className="text-primary">RFC-0</span>{' '}
                <span className="text-on-surface-variant">· overview · este documento</span>
              </li>
              <li>
                <span className="text-primary">RFC-1</span>{' '}
                <span className="text-on-surface-variant">
                  · manifest schema · obrigatório para criadores e provider nodes
                </span>
              </li>
              <li>
                <span className="text-primary">RFC-2</span>{' '}
                <span className="text-on-surface-variant">
                  · content addressing · obrigatório para todos os papéis
                </span>
              </li>
              <li>
                <span className="text-primary">RFC-3</span>{' '}
                <span className="text-on-surface-variant">
                  · autenticação e assinatura · obrigatório para criadores e verificadores
                </span>
              </li>
              <li>
                <span className="text-primary">RFC-4</span>{' '}
                <span className="text-on-surface-variant">
                  · acceptable use policy · obrigatório para clientes que oferecem feed
                </span>
              </li>
              <li>
                <span className="text-primary">RFC-5</span>{' '}
                <span className="text-on-surface-variant">
                  · persistence pool · obrigatório para provider nodes
                </span>
              </li>
              <li>
                <span className="text-primary">RFC-6</span>{' '}
                <span className="text-on-surface-variant">
                  · risk score · rascunho, planejado sprint 3
                </span>
              </li>
              <li>
                <span className="text-primary">RFC-7</span>{' '}
                <span className="text-on-surface-variant">
                  · moderação e júri ecumênica · rascunho, planejado sprint 4
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section id="s6-seguranca" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            considerações de segurança
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Ameaças estruturais ao protocolo são tratadas em §10 do whitepaper. Implementações
              MUST considerar ao menos:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                coerção legal contra Aevia LLC não remove conteúdo on-chain; implementações
                alternativas continuam a servir mesmo que a cliente canônica seja ordenada a
                desindexar.
              </li>
              <li>
                provider desonesto é derrotado pelo desafio de byte-range dentro de janela apertada
                (RFC-5 §4).
              </li>
              <li>
                Sybil é neutralizado pelo pagamento ser proporcional a byte-horas replicadas, não a
                número de nós.
              </li>
              <li>eclipse na DHT é mitigado por refresh de buckets com probing aleatório.</li>
              <li>captura econômica do pool dispara revisão do Conselho (RFC-7).</li>
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
              <li>RFC-1 — Manifest Schema</li>
              <li>RFC-2 — Content Addressing</li>
              <li>RFC-3 — Authentication and Signature</li>
              <li>RFC-4 — Acceptable Use Policy</li>
              <li>RFC-5 — Persistence Pool</li>
              <li>Aevia Whitepaper v1 (abril 2026)</li>
            </ol>
          </div>
        </section>
      </>
    );
  },
};
