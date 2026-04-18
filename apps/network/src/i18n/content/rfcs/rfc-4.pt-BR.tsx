import type { RFCContent } from './types';

export const rfc4PtBR: RFCContent = {
  toc: [
    { id: 's1-escopo', label: '§1 · escopo' },
    { id: 's2-principio', label: '§2 · princípio da separação' },
    { id: 's3-exclusoes', label: '§3 · exclusões normativas' },
    { id: 's4-thresholds', label: '§4 · thresholds de aplicação' },
    { id: 's5-takedown', label: '§5 · procedimentos legais' },
    { id: 's6-apelacao', label: '§6 · apelação' },
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
              Este documento é a forma normativa da Acceptable Use Policy (AUP) do protocolo Aevia.
              Define quais categorias de conteúdo não são amplificadas, como thresholds operacionais
              aplicam essas restrições, e os procedimentos legais obrigatórios. A página UI em{' '}
              <span className="font-mono">/aup</span> é a forma legível por humanos; este RFC é a
              referência canônica.
            </p>
            <p>MUST, SHOULD, MAY seguem RFC 2119.</p>
          </div>
        </section>

        <section id="s2-principio" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            princípio da separação
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Esta AUP governa <em>distribuição</em>, não <em>persistência</em>. Conteúdo que viola
              §3 permanece no IPFS e no Content Registry; o que é revogado é o subsídio do
              persistence pool, o surface em feed curado, e o peso em ranking. Implementações
              conformes MUST preservar recuperabilidade por CID de todo conteúdo canonicamente
              assinado, independentemente de sua elegibilidade editorial.
            </p>
            <p>
              Este princípio é load-bearing para a imunidade da Aevia LLC como intermediário sob 47
              U.S.C. §230. Ao modular distribuição com critério público, a Aevia exerce moderação
              protegida pela section 230(c)(2)(a); ao não suprimir bits, não se torna publisher do
              conteúdo alheio.
            </p>
          </div>
        </section>

        <section id="s3-exclusoes" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            exclusões normativas
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Implementações conformes MUST excluir as categorias abaixo de subsídio e de feed
              curado. Categorias marcadas com{' '}
              <span className="font-mono text-danger">[ABSOLUTE]</span> adicionalmente MUST ser
              removidas de indexação e reportadas conforme §5.
            </p>
            <ul className="list-none pl-0 space-y-3">
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[a]</span> pornografia e conteúdo
                sexualmente explícito.
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[b]</span>{' '}
                <span className="font-mono text-danger">[ABSOLUTE]</span> qualquer sexualização de
                menores — tolerância zero absoluta; reporte NCMEC CyberTipline obrigatório conforme
                18 U.S.C. §2258A.
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[c]</span>{' '}
                <span className="font-mono text-danger">[ABSOLUTE]</span> conteúdo íntimo não
                consentido (NCII), incluindo deepfakes sexualizados — conforme SHIELD Act (15 U.S.C.
                §6851).
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[d]</span> apologia celebratória de
                violência, terrorismo ou dano físico a pessoas.
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[e]</span> apologia celebratória de aborto.
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[f]</span> ocultismo, satanismo e
                feitiçaria como prática.
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[g]</span> apologia de uso recreativo de
                drogas ilícitas.
              </li>
              <li className="text-on-surface-variant">
                <span className="font-mono text-primary">[h]</span> discurso de ódio acionável
                contra qualquer grupo — incluindo cristãos, judeus, muçulmanos, ateus e quaisquer
                outros.
              </li>
            </ul>
          </div>
        </section>

        <section id="s4-thresholds" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            thresholds de aplicação
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Decisões operacionais são tomadas via Risk Score (RFC-6). Esta AUP especifica os
              thresholds:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>
                <span className="font-mono text-primary">θ_subsidy = 0.5</span> — CIDs com R(c) ≥
                0.5 SÃO excluídos de compensação do persistence pool.
              </li>
              <li>
                <span className="font-mono text-primary">θ_feed = 0.3</span> — CIDs com R(c) ≥ 0.3
                SÃO excluídos do feed curado e de ranking em clientes Aevia.
              </li>
              <li>
                conteúdo marcado <span className="font-mono text-danger">[ABSOLUTE]</span> MUST ter{' '}
                <span className="font-mono">R_values = 1</span> independentemente do classificador,
                e adicionalmente MUST ser desindexado e (para [b]) escalado à NCMEC em até 24 horas
                da detecção.
              </li>
            </ul>
            <p>
              Thresholds e pesos da fórmula são parâmetros de protocolo sujeitos a aprovação do
              Conselho (RFC-7).
            </p>
          </div>
        </section>

        <section id="s5-takedown" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            procedimentos legais
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>Implementações operando como intermediário sob jurisdição US/EEA MUST:</p>
            <ul className="list-disc pl-6 space-y-3 text-on-surface-variant">
              <li>
                <strong className="text-accent">DMCA §512</strong> — designar agente junto ao U.S.
                Copyright Office, aceitar notificações com elementos exigidos por §512(c)(3),
                respeitar janela de contra-notificação de 10–14 dias úteis, aplicar política de
                strikes (1º=aviso, 2º=revisão manual + suspensão, 3º=terminação).
              </li>
              <li>
                <strong className="text-accent">DSA art. 16</strong> — operar canal
                notice-and-action, responder em até 7 dias úteis com justificativa fundamentada
                quando a decisão for desfavorável ao notificante.
              </li>
              <li>
                <strong className="text-accent">NCMEC CyberTipline</strong> — reportar CSAM aparente
                em até 24h; preservar material 90 dias conforme §2258A(h); não revisar além do
                mínimo para reporte.
              </li>
              <li>
                <strong className="text-accent">OFAC</strong> — não prover serviço a
                residentes/entidades em jurisdições sob sanções compreensivas; consultar SDN List.
              </li>
            </ul>
          </div>
        </section>

        <section id="s6-apelacao" className="py-12">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
            apelação
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
            <p>
              Criadores cujo conteúdo foi restringido MAY solicitar revisão por júri conforme RFC-7.
              A solicitação MUST:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant">
              <li>ser enviada em até 30 dias após a notificação de restrição;</li>
              <li>
                conter o CID em disputa e a justificativa de que a classificação sob §3 é incorreta;
              </li>
              <li>ser assinada pela chave do criador (RFC-3) para evitar abuso por terceiros.</li>
            </ul>
            <p>
              Decisões de apelação MUST ser publicadas no Trust Ledger com justificativa textual.
              Reclassificações resultam em atualização dos componentes{' '}
              <span className="font-mono">R_abuse</span> e{' '}
              <span className="font-mono">R_values</span> do Risk Score.
            </p>
            <p>
              Categorias <span className="font-mono text-danger">[ABSOLUTE]</span> NÃO admitem
              apelação. Esta restrição é deliberada.
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
                flag spam: reporters maliciosos podem tentar deprimir{' '}
                <span className="font-mono">R_abuse</span> via reportes em massa. Implementações
                SHOULD ponderar por reputação do reporter e exigir custo mínimo por reporte.
              </li>
              <li>
                classificador adversarial: conteúdo pode ser construído para evadir classificadores
                de <span className="font-mono">R_values</span>. Revisão manual por júri é o recurso
                de último estágio.
              </li>
              <li>
                captura regulatória: tentativa de pressão governamental para ampliar a lista de §3
                MUST passar pelo Conselho e pelo Trust Ledger — sem via unilateral pela Aevia LLC.
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
              <li>17 U.S.C. §512 — DMCA safe harbor</li>
              <li>47 U.S.C. §230 — Section 230 intermediary immunity</li>
              <li>18 U.S.C. §2258A — NCMEC reporting requirements</li>
              <li>15 U.S.C. §6851 — SHIELD Act</li>
              <li>Regulation (EU) 2022/2065 — Digital Services Act</li>
              <li>RFC-6 — Risk Score (draft)</li>
              <li>RFC-7 — Moderation and Ecumenical Jury (draft)</li>
            </ol>
          </div>
        </section>
      </>
    );
  },
};
