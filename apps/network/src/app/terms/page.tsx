import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'terms · aevia.network',
  description:
    'termos de serviço da aevia. o acordo entre você e a aevia llc. leia antes de usar a rede.',
};

export default function Terms() {
  return (
    <>
      <Nav locale="pt-BR" />
      <main className="mx-auto max-w-[1440px] px-12">
        {/* Masthead */}
        <section className="mx-auto max-w-[72ch] pt-[200px]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">
            política · terms
          </span>
          <h1 className="mt-6 font-headline text-[96px] font-bold leading-[1.05] tracking-tight">
            termos de serviço
          </h1>
          <p className="mt-8 max-w-[68ch] text-xl text-on-surface-variant leading-[1.7]">
            este é o acordo entre você e a aevia llc. ao usar aevia.network, aevia.video ou qualquer
            serviço da aevia, você concorda com os termos abaixo. leia antes de usar.
          </p>
          <p className="mt-8 font-mono text-sm text-on-surface-variant">
            versão 0.1 · publicado 2026-04-17 · jurisdição delaware, usa
          </p>
        </section>

        <div className="mx-auto mt-24 max-w-[72ch] border-t border-primary-dim/40" />

        {/* §1 Aceitação */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§1</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">aceitação</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            ao acessar ou usar os serviços da aevia (inclui aevia.network, aevia.video, o protocolo
            subjacente e qualquer superfície identificada como operada pela aevia llc), você aceita
            estes termos e a{' '}
            <Link href="/aup" className="text-primary hover:text-primary-dim underline">
              acceptable use policy
            </Link>{' '}
            e a{' '}
            <Link href="/privacy" className="text-primary hover:text-primary-dim underline">
              política de privacidade
            </Link>
            , que são incorporadas por referência. se não concorda, não use.
          </p>
        </section>

        {/* §2 Elegibilidade */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">elegibilidade</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            você declara ter idade mínima aplicável conforme aup §3, não estar localizado em
            jurisdição sob sanções compreensivas ofac (aup §8), não estar listado na specially
            designated nationals and blocked persons list, e ter capacidade legal para celebrar este
            contrato. se você usa a aevia em nome de pessoa jurídica, declara ter autoridade para
            vincular a entidade.
          </p>
        </section>

        {/* §3 Conta */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            conta e responsabilidade
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            a conta aevia é ancorada em uma wallet operada via privy. você é responsável por
            proteger as credenciais associadas à sua wallet e por todas as ações executadas a partir
            dela. a aevia não pode reverter transações on-chain, recuperar chaves perdidas ou
            desfazer assinaturas criptográficas. perda de acesso à wallet significa perda de
            capacidade de assinar futuros manifestos — conteúdo previamente ancorado permanece no
            ipfs e na base l2.
          </p>
        </section>

        {/* §4 Licença e propriedade do conteúdo */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            conteúdo do usuário: propriedade e licença
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            você retém todos os direitos sobre o conteúdo que publica na aevia. você nos concede,
            pelo tempo de operação do serviço, licença não-exclusiva, gratuita, mundial e
            sublicenciável, limitada às seguintes finalidades: (i) armazenar e replicar o conteúdo
            via provider nodes para cumprir seu manifesto; (ii) transmitir o conteúdo a usuários
            finais que o solicitem; (iii) exibi-lo em superfícies editoriais (feed, ranking) quando
            elegível conforme aup. a licença termina automaticamente se você excluir a referência
            canônica — ressalvado que o conteúdo on-chain e no ipfs permanece imutável por design.
          </p>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            você declara que possui os direitos necessários para conceder esta licença e que o
            conteúdo não infringe direitos de terceiros.
          </p>
        </section>

        {/* §5 Uso proibido */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            uso proibido e conteúdo excluído
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            o uso do serviço está sujeito à{' '}
            <Link href="/aup" className="text-primary hover:text-primary-dim underline">
              acceptable use policy
            </Link>
            . ao aup rege o que o protocolo não amplifica e como respondemos a abusos. violações
            podem resultar em perda de subsidy, desindexação, suspensão ou terminação conforme §7.
          </p>
        </section>

        {/* §6 Takedowns e propriedade intelectual */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            propriedade intelectual e takedowns
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            procedimentos dmca (17 u.s.c. §512) e notice-and-action (dsa, (ue) 2022/2065) estão
            descritos na{' '}
            <Link href="/aup" className="text-primary hover:text-primary-dim underline">
              aup §4 e §5
            </Link>
            . &ldquo;aevia&rdquo;, &ldquo;aevia.network&rdquo;, &ldquo;aevia.video&rdquo; e o
            wordmark são marcas da aevia llc. licenças de código-fonte (apache-2.0 para
            contracts/protocol-spec, agpl-3.0 para clients, mit para design system) estão em{' '}
            <a
              href="https://github.com/Leeaandrob/aevia/blob/main/LICENSES.md"
              className="text-primary hover:text-primary-dim underline"
            >
              LICENSES.md
            </a>
            .
          </p>
        </section>

        {/* §7 Terminação */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">terminação</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            você pode parar de usar a qualquer momento; manifestos previamente ancorados permanecem
            no ipfs e na base l2 por design. a aevia pode suspender ou terminar seu acesso a
            subsidy, ranking e feed por violação material de aup, por reincidência dmca conforme
            política de strikes (aup §4), por obrigação legal, ou a critério próprio após aviso
            prévio razoável (exceto em casos de conteúdo criminal que exija ação imediata).
          </p>
        </section>

        {/* §8 Disclaimer de garantia */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§8</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            disclaimer de garantia
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7] uppercase-none">
            o serviço é fornecido &ldquo;como está&rdquo; e &ldquo;conforme disponível&rdquo;. a
            aevia rejeita, na máxima extensão permitida por lei aplicável, todas as garantias
            expressas, implícitas ou estatutárias, incluindo garantias de comerciabilidade,
            adequação a propósito específico, título e não-infração. a aevia não garante que o
            serviço será ininterrupto, livre de erros, ou seguro contra perda de dados. blockchain,
            ipfs e p2p são tecnologias novas — você assume o risco tecnológico.
          </p>
        </section>

        {/* §9 Limitação de responsabilidade */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§9</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            limitação de responsabilidade
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            na máxima extensão permitida por lei, a responsabilidade total da aevia llc, suas
            afiliadas, diretores, funcionários e agentes por qualquer causa agregada não excederá o
            maior valor entre (a) usd 100, ou (b) o total efetivamente pago por você à aevia nos 12
            meses anteriores ao evento. em nenhuma hipótese a aevia será responsável por danos
            indiretos, incidentais, especiais, consequenciais, punitivos, ou por lucros cessantes,
            perda de dados, perda de reputação ou qualquer dano que a aevia não poderia
            razoavelmente prever.
          </p>
        </section>

        {/* §10 Indenização */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§10</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">indenização</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            você concorda em indenizar e manter a aevia llc isenta de qualquer reclamação,
            responsabilidade, dano, perda ou despesa (incluindo honorários advocatícios razoáveis)
            decorrentes de: (i) conteúdo que você publicou; (ii) violação destes termos ou da aup;
            (iii) violação de direitos de terceiros; (iv) uso indevido do serviço.
          </p>
        </section>

        {/* §11 Arbitragem */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§11</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            resolução de disputas e renúncia a ação coletiva
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            disputas decorrentes destes termos são resolvidas por arbitragem individual vinculante
            conforme{' '}
            <Link href="/aup" className="text-primary hover:text-primary-dim underline">
              aup §10
            </Link>
            , regida pelo federal arbitration act (9 u.s.c. §§1–16) e administrada pela aaa sob
            regras de arbitragem comercial, sediada em wilmington, delaware. você renuncia a
            julgamento por júri e a ações coletivas. opt-out disponível dentro de 30 dias após
            primeiro uso, enviando e-mail a contact@aevia.network com assunto{' '}
            <span className="font-mono">arbitration opt-out</span>.
          </p>
        </section>

        {/* §12 Lei aplicável */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§12</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            lei aplicável e foro
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            estes termos são regidos pela legislação do estado de delaware, estados unidos da
            américa, com exclusão de suas normas de conflito de leis. disputas não submetidas a
            arbitragem (ex: ações de propriedade intelectual) são resolvidas nas cortes estaduais ou
            federais localizadas em delaware, e as partes consentem em tal jurisdição. a convenção
            de viena sobre contratos de compra e venda internacional de mercadorias (cisg) não se
            aplica.
          </p>
        </section>

        {/* §13 Modificações */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§13</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            modificações destes termos
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            podemos modificar estes termos. mudanças materiais entram em vigor 30 dias após
            publicação, dando tempo para você sair se não concordar. mudanças não-materiais (como
            correção de redação ou atualização de endereços) entram em vigor na publicação.
          </p>
        </section>

        {/* §14 Integralidade e severabilidade */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§14</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            integralidade, severabilidade, cessão
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            estes termos, juntos com a aup, a política de privacidade e qualquer adendo publicado,
            constituem o acordo integral entre você e a aevia llc sobre o serviço, e substituem
            qualquer acordo anterior. se qualquer disposição for considerada inválida, as demais
            permanecem em vigor. não-exercício de direito não implica renúncia. você não pode ceder
            seus direitos sob este acordo sem consentimento escrito da aevia; a aevia pode ceder
            livremente.
          </p>
        </section>

        {/* §15 Contato */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8">
            <span className="font-label text-xs text-tertiary">§15 · contato contratual</span>
            <p className="mt-2 max-w-[72ch] text-base text-on-surface-variant leading-[1.7]">
              aevia llc · delaware, usa ·{' '}
              <a
                href="mailto:contact@aevia.network?subject=terms inquiry"
                className="text-primary hover:text-primary-dim"
              >
                contact@aevia.network
              </a>
              . entregas por correio postal devem ser endereçadas ao registered agent da aevia llc
              no estado de delaware (detalhes fornecidos mediante solicitação).
            </p>
          </div>
        </section>

        <div className="pb-[120px]" />
      </main>
      <Footer />
    </>
  );
}
