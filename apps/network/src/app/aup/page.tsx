import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'aup · aevia.network',
  description:
    'acceptable use policy da aevia. o que o protocolo não amplifica, por quê, e como lidamos com takedowns dmca, dsa, lgpd, ncmec e sanções.',
};

const EXCLUSIONS = [
  {
    key: '[a]',
    text: 'pornografia e conteúdo sexualmente explícito',
  },
  {
    key: '[b]',
    text: 'qualquer sexualização de menores — tolerância zero absoluta; reporte à ncmec cybertipline conforme 18 u.s.c. §2258a',
  },
  {
    key: '[c]',
    text: 'conteúdo íntimo não consentido (ncii), incluindo deepfakes sexualizados — conforme shield act (15 u.s.c. §6851)',
  },
  {
    key: '[d]',
    text: 'apologia celebratória de violência, terrorismo ou dano físico a pessoas',
  },
  {
    key: '[e]',
    text: 'apologia celebratória de aborto',
  },
  {
    key: '[f]',
    text: 'ocultismo, satanismo e feitiçaria como prática',
  },
  {
    key: '[g]',
    text: 'apologia de uso recreativo de drogas ilícitas',
  },
  {
    key: '[h]',
    text: 'discurso de ódio acionável contra qualquer grupo — incluindo cristãos, judeus, muçulmanos, ateus e quaisquer outros',
  },
];

export default function AUP() {
  return (
    <>
      <Nav active="aup" locale="pt-BR" />
      <main className="mx-auto max-w-[1440px] px-12">
        {/* Masthead */}
        <section className="mx-auto max-w-[72ch] pt-[200px]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">política · aup</span>
          <h1 className="mt-6 font-headline text-[96px] font-bold leading-[1.05] tracking-tight">
            acceptable use policy
          </h1>
          <p className="mt-8 max-w-[68ch] text-xl text-on-surface-variant leading-[1.7]">
            o que a aevia não amplifica, por que isso preserva imunidade sob section 230, e como
            lidamos com takedowns dmca, dsa, ncmec, lgpd e sanções.
          </p>
          <p className="mt-8 font-mono text-sm text-on-surface-variant">
            versão 0.1 · publicado 2026-04-17 · jurisdição delaware, usa
          </p>
        </section>

        <div className="mx-auto mt-24 max-w-[72ch] border-t border-primary-dim/40" />

        {/* §1 Lead */}
        <section className="mx-auto mt-24 max-w-[72ch] space-y-6">
          <p className="max-w-[72ch] text-lg leading-[1.7]">
            a aevia distingue persistência e distribuição. persistência significa que seu conteúdo
            continua existindo na blockchain e no ipfs. distribuição significa que nós pagamos para
            hospedá-lo em nós de persistência, mostramos ele no feed, ou subsidiamos seu alcance.
            esta política rege a segunda, não a primeira.
          </p>
          <p className="max-w-[72ch] text-lg leading-[1.7]">
            o que você ler abaixo não proíbe bits no ipfs raw. decreta apenas que tipos de conteúdo
            não recebem cheque do persistence pool, não entram no feed curado e não são surfaceados
            em ranking. a diferença é arquitetural e intencional — e é o que preserva a imunidade da
            aevia como intermediário sob section 230 (47 u.s.c. §230).
          </p>
        </section>

        {/* §2 Exclusões */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-5xl font-bold leading-tight">
            o que a aevia não amplifica
          </h2>
          <p className="mt-6 max-w-[72ch] text-lg leading-[1.7] text-on-surface-variant">
            os itens a seguir são excluídos de subsidy do persistence pool, de ranking algorítmico e
            de feed curado. não são uma lista de &lsquo;conteúdo proibido&rsquo; — são uma
            declaração de como o protocolo dirige seus recursos econômicos e editoriais.
          </p>
          <ol className="mt-10 space-y-3">
            {EXCLUSIONS.map((item) => (
              <li key={item.key} className="max-w-[72ch] text-base text-accent leading-[1.6]">
                <span className="mr-3 font-mono text-primary">{item.key}</span>
                {item.text}
              </li>
            ))}
          </ol>
        </section>

        {/* §3 Idade mínima */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">idade mínima</h2>
          <p className="mt-4 max-w-[72ch] text-base text-on-surface-variant leading-[1.7]">
            a aevia não é direcionada a menores de 13 anos, conforme coppa (15 u.s.c. §6501). para
            residentes no espaço econômico europeu, a idade mínima é 16 anos, conforme art. 8 gdpr.
            para residentes no brasil, a idade mínima é 13 anos com autorização parental e 18 anos
            sem, conforme art. 14 lgpd. se descobrirmos dados pessoais de menor abaixo da idade
            mínima aplicável, esses dados são deletados.
          </p>
        </section>

        {/* §4 DMCA */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/40 bg-surface-container-low p-10">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">
              §4 · dmca · 17 u.s.c. §512
            </span>
            <h3 className="mt-2 font-headline text-3xl font-bold leading-tight">
              procedimento de takedown por copyright
            </h3>
            <p className="mt-6 text-base leading-[1.7]">
              a aevia llc opera como intermediário sob os termos do digital millennium copyright
              act. ao concluir o registro formal de agente designado junto ao u.s. copyright office,
              publicaremos aqui o número de registro e a data de validade. até lá, notificações de
              infração devem ser enviadas a contact@aevia.network com assunto{' '}
              <span className="font-mono">dmca takedown</span> e conter os elementos exigidos por 17
              u.s.c. §512(c)(3): identificação do trabalho, localização na aevia, contato do
              notificante, declaração de boa-fé, declaração sob perjúrio, e assinatura.
            </p>
            <p className="mt-4 text-base leading-[1.7]">
              a contra-notificação respeita o prazo legal de 10 a 14 dias úteis antes de restauração
              do conteúdo. política de reincidência: primeiro strike gera aviso, segundo strike
              revisão manual com suspensão temporária, terceiro strike termina a conta e remove o
              acesso a subsidy. contas terminadas não retornam via criação de nova conta.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-8">
              <div>
                <span className="font-label text-xs text-tertiary">agente designado</span>
                <p className="mt-2 font-mono text-sm text-accent">
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
                  className="mt-2 inline-flex items-center gap-1 font-mono text-sm text-primary hover:text-primary-dim"
                >
                  u.s. copyright office <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* §5 DSA */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5 · ue</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            digital services act — notice & action
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            para usuários no espaço econômico europeu, a aevia opera um canal de notice-and-action
            conforme art. 16 do regulamento (ue) 2022/2065 (dsa). notificações de conteúdo ilegal
            devem ser enviadas para contact@aevia.network com assunto{' '}
            <span className="font-mono">dsa notice</span> e conter: razão legal alegada, localização
            do conteúdo, identidade do notificante (quando exigível) e declaração de boa-fé.
            respondemos em até sete dias úteis com justificativa fundamentada quando a decisão não
            for favorável, conforme art. 17. nosso relatório anual de transparência será publicado
            em /transparency a partir da primeira janela elegível.
          </p>
        </section>

        {/* §6 Section 230 */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6 · usa</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            postura sob section 230
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            a aevia modera distribuição — ranking, subsidy do persistence pool, feed surfacing — com
            critério editorial público e explícito. a aevia <em>não</em> assume responsabilidade
            pela acurácia, legalidade ou caráter do conteúdo gerado por usuários. usuários são os
            publishers dos próprios manifestos.
          </p>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            essa postura invoca imunidade sob 47 u.s.c. §230(c)(1) e proteção good samaritan sob
            §230(c)(2)(a). nada nesta política transforma a aevia em publisher do conteúdo alheio;
            descrever o que <em>não amplificamos</em> é exatamente o exercício da moderação que a
            seção 230(c)(2)(a) protege.
          </p>
        </section>

        {/* §7 NCMEC */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="border-l-2 border-danger/60 bg-surface-container-low py-4 pl-6">
            <span className="font-label text-xs tracking-[0.04em] text-danger">
              §7 · ncmec cybertipline
            </span>
            <p className="mt-2 max-w-[72ch] text-base text-accent leading-[1.6]">
              material de abuso sexual infantil aparente é reportado à ncmec cybertipline conforme
              18 u.s.c. §2258a. preservamos o material por 90 dias conforme §2258a(h), não revisamos
              o conteúdo além do mínimo para reporte (para não comprometer o entendimento de
              private-search sob 4ª emenda), e não permitimos apelação. não há chamada de
              julgamento.
            </p>
          </div>
        </section>

        {/* §8 Sanções */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§8 · ofac</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            sanções e jurisdições excluídas
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            os serviços da aevia não estão disponíveis para residentes, entidades ou operadores
            localizados em jurisdições sob sanções compreensivas dos estados unidos (office of
            foreign assets control — ofac), incluindo mas não limitadas a cuba, irã, coreia do
            norte, síria e regiões ocupadas da ucrânia. também excluídos pessoas e entidades
            listadas na specially designated nationals and blocked persons list. uso em violação
            destas restrições pode resultar em bloqueio imediato e reporte às autoridades
            competentes.
          </p>
        </section>

        {/* §9 Privacidade */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§9</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            privacidade e dados pessoais
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            o tratamento de dados pessoais é regido pela{' '}
            <Link href="/privacy" className="text-primary hover:text-primary-dim underline">
              política de privacidade
            </Link>{' '}
            da aevia, que cobre ccpa/cpra (california), gdpr (ue), lgpd (brasil) e direitos de
            sujeito de dados associados. a aevia llc não vende dados pessoais na definição ccpa.
          </p>
        </section>

        {/* §10 Arbitragem */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§10</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            resolução de disputas e renúncia a ação coletiva
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            qualquer controvérsia, reclamação ou disputa decorrente desta política ou do uso dos
            serviços da aevia será resolvida por arbitragem individual vinculante, conduzida pela
            american arbitration association (aaa) sob as regras de arbitragem comercial, sediada em
            wilmington, delaware, em idioma inglês. você e a aevia renunciam expressamente ao
            direito a julgamento por júri e a participar de ação coletiva ou arbitragem coletiva
            como representado ou representante. esta cláusula é regida pelo federal arbitration act
            (9 u.s.c. §§1–16). opt-out dentro de 30 dias após primeiro uso do serviço, enviando
            e-mail para contact@aevia.network com assunto{' '}
            <span className="font-mono">arbitration opt-out</span>.
          </p>
        </section>

        {/* §11 Limitação de responsabilidade */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§11</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            limitação de responsabilidade e garantia
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            os serviços da aevia são fornecidos &ldquo;como estão&rdquo; e &ldquo;conforme
            disponíveis&rdquo;, sem garantia expressa ou implícita de adequação, disponibilidade,
            ausência de erros ou não violação. na máxima extensão permitida por lei, a
            responsabilidade da aevia llc, suas afiliadas, diretores, funcionários e agentes por
            qualquer causa agregada, contratual ou extracontratual, não excederá o valor total
            efetivamente pago pelo usuário à aevia nos doze meses anteriores ao evento que deu
            origem à reclamação, ou usd 100, o que for maior. em nenhuma hipótese a aevia será
            responsável por danos indiretos, incidentais, especiais, consequenciais, punitivos ou
            lucros cessantes.
          </p>
        </section>

        {/* §12 Indenização */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§12</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">indenização</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            o usuário concorda em indenizar e manter a aevia llc isenta de qualquer reclamação,
            demanda, responsabilidade, dano, perda ou despesa (incluindo honorários advocatícios
            razoáveis) decorrentes de ou relacionadas a: (i) conteúdo publicado pelo usuário; (ii)
            violação desta política ou dos termos de serviço; (iii) violação de direitos de
            terceiros; (iv) uso indevido dos serviços.
          </p>
        </section>

        {/* §13 Jurisdição */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8">
            <span className="font-label text-xs text-tertiary">§13 · jurisdição</span>
            <p className="mt-2 max-w-[72ch] text-base text-on-surface-variant leading-[1.7]">
              esta política é publicada pela aevia llc, uma limited liability company de delaware,
              estados unidos da américa. regida pela legislação de delaware, com exclusão de suas
              normas de conflito de leis. disputas não sujeitas à cláusula §10 de arbitragem
              (incluindo ações de propriedade intelectual) são resolvidas em cortes estaduais ou
              federais localizadas em delaware, e as partes consentem em tal jurisdição. a convenção
              de viena sobre contratos de compra e venda internacional de mercadorias (cisg) não se
              aplica. versões desta política em outros idiomas são de conveniência; a versão em
              inglês prevalece em caso de conflito.
            </p>
          </div>
        </section>

        <div className="pb-[120px]" />
      </main>
      <Footer />
    </>
  );
}
