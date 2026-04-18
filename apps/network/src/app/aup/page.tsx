import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'aup · aevia.network',
  description:
    'acceptable use policy da aevia. o que o protocolo não amplifica, por quê, e como lidamos com takedowns dmca.',
};

export default function AUP() {
  return (
    <>
      <Nav active="aup" locale="pt-BR" />
      <main className="mx-auto max-w-[1440px] px-12">
        <section className="pt-[200px] max-w-[72ch] mx-auto">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">política · aup</span>
          <h1 className="font-headline text-[96px] font-bold leading-[1.05] tracking-tight mt-6">
            acceptable use policy
          </h1>
          <p className="text-xl text-on-surface-variant leading-[1.7] max-w-[68ch] mt-8">
            o que a aevia não amplifica, por que isso preserva imunidade sob section 230, e como
            lidamos com takedowns dmca.
          </p>
          <p className="font-mono text-sm text-on-surface-variant mt-8">
            versão 0.1 · publicado 2026-04-16 · jurisdição delaware, usa
          </p>
        </section>

        <div className="max-w-[72ch] mx-auto mt-24">
          <div className="border-t border-primary-dim/40" />
        </div>

        <section className="max-w-[72ch] mx-auto mt-24 space-y-8">
          <p className="text-lg leading-[1.7] max-w-[72ch]">
            a aevia distingue persistência e distribuição. persistência significa que seu conteúdo
            continua existindo na blockchain e no ipfs. distribuição significa que nós pagamos para
            hospedá-lo em nós de persistência, mostramos ele no feed, ou subsidiamos seu alcance.
            esta política rege a segunda, não a primeira.
          </p>
          <p className="text-lg leading-[1.7] max-w-[72ch]">
            o que você ler abaixo não proíbe bits no ipfs raw. decreta apenas que tipos de conteúdo
            não recebem cheque do persistence pool, não entram no feed curado e não são surfaceados
            em ranking. a diferença é arquitetural e intencional.
          </p>
        </section>

        <section className="max-w-[72ch] mx-auto pt-24">
          <h2 className="font-headline text-5xl font-bold leading-tight mb-6">
            o que a aevia não amplifica
          </h2>
          <p className="max-w-[72ch] text-lg leading-[1.7] text-on-surface-variant">
            os itens a seguir são excluídos de subsidy e ranking. não são uma lista de
            &lsquo;conteúdo proibido&rsquo; — são uma declaração de como o protocolo dirige seus
            recursos.
          </p>
          <ol className="mt-10 space-y-3">
            <li className="text-base text-accent leading-[1.6] max-w-[72ch]">
              <span className="font-mono text-primary mr-3">[a]</span>
              pornografia e conteúdo sexualmente explícito
            </li>
            <li className="text-base text-accent leading-[1.6] max-w-[72ch]">
              <span className="font-mono text-primary mr-3">[b]</span>
              qualquer sexualização de menores — tolerância zero absoluta; reporte a ncmec conforme
              18 u.s.c. §2258a
            </li>
            <li className="text-base text-accent leading-[1.6] max-w-[72ch]">
              <span className="font-mono text-primary mr-3">[c]</span>
              apologia celebratória de aborto
            </li>
            <li className="text-base text-accent leading-[1.6] max-w-[72ch]">
              <span className="font-mono text-primary mr-3">[d]</span>
              ocultismo, satanismo e feitiçaria como prática
            </li>
            <li className="text-base text-accent leading-[1.6] max-w-[72ch]">
              <span className="font-mono text-primary mr-3">[e]</span>
              apologia de drogas
            </li>
            <li className="text-base text-accent leading-[1.6] max-w-[72ch]">
              <span className="font-mono text-primary mr-3">[f]</span>
              discurso de ódio acionável contra qualquer grupo — incluindo cristãos
            </li>
            <li className="text-base text-accent leading-[1.6] max-w-[72ch]">
              <span className="font-mono text-primary mr-3">[g]</span>
              apologia de violência
            </li>
          </ol>
        </section>

        <section className="max-w-[72ch] mx-auto pt-24">
          <div className="bg-surface-container-low border border-primary-dim/40 rounded-lg p-10">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">
              dmca · 17 u.s.c. §512
            </span>
            <h3 className="font-headline text-3xl font-bold leading-tight mt-2">
              procedimento de takedown
            </h3>
            <p className="text-base leading-[1.7] mt-6">
              aevia llc registrou agente designado junto ao u.s. copyright office. notificações de
              infração conforme 17 u.s.c. §512(c)(3) devem ser enviadas a contact@aevia.network com
              assunto <span className="font-mono">dmca takedown</span>.
            </p>
            <p className="text-base leading-[1.7] mt-4">
              a janela de contra-notificação respeita o prazo legal de 10–14 dias úteis. contas com
              repetidas violações são revisadas no segundo strike e terminadas no terceiro.
            </p>
            <div className="grid grid-cols-2 gap-8 mt-10">
              <div>
                <span className="font-label text-xs text-tertiary">agente designado</span>
                <p className="font-mono text-sm text-accent mt-2">
                  aevia llc
                  <br />
                  contact@aevia.network
                  <br />
                  delaware, usa
                </p>
              </div>
              <div>
                <span className="font-label text-xs text-tertiary">registro oficial</span>
                <a
                  href="https://www.copyright.gov/dmca-directory/"
                  className="font-mono text-sm text-primary hover:text-primary-dim inline-flex items-center gap-1 mt-2"
                >
                  u.s. copyright office <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-[72ch] mx-auto">
          <h2 className="font-headline text-5xl font-bold mb-6 mt-24 leading-tight">
            postura sob section 230
          </h2>
          <p className="max-w-[72ch] text-lg leading-[1.7]">
            a aevia modera distribuição (ranking, subsidy, feed surfacing) com critério editorial
            explícito. a aevia não assume responsabilidade pela acurácia, legalidade ou caráter do
            conteúdo gerado por usuários — usuários são os publishers dos próprios manifestos.
          </p>
          <p className="max-w-[72ch] text-lg leading-[1.7] mt-6">
            essa postura invoca imunidade sob section 230 (c)(1) e proteção good samaritan sob
            (c)(2). isso só funciona se a linguagem desta política descrever negação de
            distribuição, não negação de hospedagem.
          </p>
        </section>

        <section className="max-w-[72ch] mx-auto">
          <div className="bg-surface-container-low border-l-2 border-danger/60 pl-6 py-4 mt-16">
            <span className="font-label text-xs tracking-[0.04em] text-danger">
              ncmec cybertipline
            </span>
            <p className="text-base text-accent leading-[1.6] mt-2 max-w-[72ch]">
              material de abuso sexual infantil aparente é reportado à ncmec cybertipline conforme
              18 u.s.c. §2258a. não há apelação. não há chamada de julgamento.
            </p>
          </div>
        </section>

        <section className="max-w-[72ch] mx-auto">
          <h3 className="font-headline text-2xl font-bold mt-16 mb-4">privacidade (ccpa)</h3>
          <p className="text-base text-on-surface-variant leading-[1.7] max-w-[72ch]">
            residentes da california podem solicitar divulgação ou deleção de dados pessoais
            enviando e-mail para contact@aevia.network. aevia llc não vende dados pessoais conforme
            definição ccpa.
          </p>
        </section>

        <section className="max-w-[72ch] mx-auto">
          <div className="mt-16 bg-surface-container-low rounded-lg p-8 border border-primary-dim/30">
            <span className="font-label text-xs text-tertiary">jurisdição</span>
            <p className="text-base text-on-surface-variant leading-[1.7] max-w-[72ch] mt-2">
              esta política é publicada pela aevia llc, uma limited liability company de delaware,
              estados unidos da américa. disputas sob esta política são regidas pela legislação do
              estado de delaware e resolvidas em cortes estaduais ou federais em delaware, na medida
              permitida pela lei aplicável.
            </p>
          </div>
        </section>

        <div className="pb-[120px]" />
      </main>
      <Footer />
    </>
  );
}
