import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'privacy · aevia.network',
  description:
    'política de privacidade da aevia. o que coletamos, por que, como você exerce direitos sob ccpa, gdpr e lgpd, e como entramos em contato.',
};

export default function Privacy() {
  return (
    <>
      <Nav locale="pt-BR" />
      <main className="mx-auto max-w-[1440px] px-12">
        {/* Masthead */}
        <section className="mx-auto max-w-[72ch] pt-[200px]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">
            política · privacy
          </span>
          <h1 className="mt-6 font-headline text-[96px] font-bold leading-[1.05] tracking-tight">
            política de privacidade
          </h1>
          <p className="mt-8 max-w-[68ch] text-xl text-on-surface-variant leading-[1.7]">
            o que coletamos, por quê, como guardamos, e como você exerce direitos sob ccpa/cpra
            (california), gdpr (união europeia) e lgpd (brasil).
          </p>
          <p className="mt-8 font-mono text-sm text-on-surface-variant">
            versão 0.1 · publicado 2026-04-17 · controlador: aevia llc · delaware, usa
          </p>
        </section>

        <div className="mx-auto mt-24 max-w-[72ch] border-t border-primary-dim/40" />

        {/* §1 Quem é o controlador */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§1</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            quem controla seus dados
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            o controlador (data controller / operador) é aevia llc, uma limited liability company de
            delaware, estados unidos da américa. contato de privacidade:{' '}
            <a
              href="mailto:contact@aevia.network?subject=privacy request"
              className="text-primary hover:text-primary-dim underline"
            >
              contact@aevia.network
            </a>
            . para lgpd no brasil, este endereço também funciona como canal do encarregado/dpo.
          </p>
        </section>

        {/* §2 O que coletamos */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            o que coletamos e por quê
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            o design da aevia minimiza coleta de dados pessoais. o que coletamos, coletamos com
            finalidade explícita:
          </p>
          <ul className="mt-6 space-y-4 max-w-[72ch] text-base leading-[1.7]">
            <li>
              <span className="font-mono text-sm text-primary">e-mail</span> — quando você entra em
              contato, solicita waitlist de provider node, ou envia notificação dmca. finalidade:
              responder à solicitação específica.
            </li>
            <li>
              <span className="font-mono text-sm text-primary">endereço de wallet</span> — quando
              você assina manifesto ou opera provider node. é um identificador público em base l2;
              não o tratamos como secret, mas registramos associação com sua operação.
            </li>
            <li>
              <span className="font-mono text-sm text-primary">logs técnicos de requisição</span> —
              ip, user-agent, rota, status code, timestamp. finalidade: operação do serviço,
              segurança, debug. retenção máxima: 30 dias.
            </li>
            <li>
              <span className="font-mono text-sm text-primary">métricas agregadas</span> — contagem
              de requisições e origem geográfica agregada via cloudflare analytics. não identificam
              indivíduos.
            </li>
          </ul>
          <p className="mt-6 max-w-[72ch] text-base leading-[1.7] text-on-surface-variant">
            a aevia <em>não</em> coleta dados sensíveis (art. 11 lgpd, art. 9 gdpr) sem
            consentimento explícito e finalidade específica. a aevia <em>não</em> constrói perfis
            comerciais, <em>não</em> vende dados pessoais conforme definição ccpa, e <em>não</em>{' '}
            compartilha dados com data brokers.
          </p>
        </section>

        {/* §3 Base legal */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3 · gdpr/lgpd</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            base legal para o tratamento
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            as bases legais sob art. 6 gdpr e art. 7 lgpd são:
          </p>
          <ul className="mt-6 space-y-3 max-w-[72ch] text-base leading-[1.7]">
            <li>
              <span className="font-mono text-sm text-primary">execução de contrato</span> — para
              operar o serviço que você solicitou (assinar manifesto, operar provider node).
            </li>
            <li>
              <span className="font-mono text-sm text-primary">legítimo interesse</span> — para
              segurança, prevenção de fraude, debug (logs técnicos).
            </li>
            <li>
              <span className="font-mono text-sm text-primary">obrigação legal</span> — para
              responder a takedowns dmca, subpoenas, reportes ncmec.
            </li>
            <li>
              <span className="font-mono text-sm text-primary">consentimento</span> — quando
              explicitamente solicitado (ex: comunicação sobre novidades do protocolo).
            </li>
          </ul>
        </section>

        {/* §4 Direitos do titular */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            direitos que você tem
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            dependendo da sua jurisdição, você tem direitos sobre seus dados pessoais. a aevia os
            reconhece universalmente ao máximo operacional que possamos. envie solicitação para
            contact@aevia.network com assunto <span className="font-mono">privacy request</span> e
            especifique qual direito. respondemos em até 30 dias.
          </p>
          <ul className="mt-6 space-y-3 max-w-[72ch] text-base leading-[1.7]">
            <li>
              <span className="font-mono text-sm text-primary">acesso</span> — obter cópia dos dados
              pessoais que mantemos (ccpa §1798.100, gdpr art. 15, lgpd art. 18 II).
            </li>
            <li>
              <span className="font-mono text-sm text-primary">retificação</span> — corrigir dados
              inexatos (gdpr art. 16, lgpd art. 18 III).
            </li>
            <li>
              <span className="font-mono text-sm text-primary">deleção</span> — apagar dados que não
              são mais necessários (ccpa §1798.105, gdpr art. 17, lgpd art. 18 VI). ressalva:
              manifestos ancorados em base l2 são imutáveis por design; o que podemos deletar são
              associações do lado off-chain.
            </li>
            <li>
              <span className="font-mono text-sm text-primary">portabilidade</span> — receber seus
              dados em formato estruturado (gdpr art. 20, lgpd art. 18 V).
            </li>
            <li>
              <span className="font-mono text-sm text-primary">objeção / opt-out de venda</span> —
              restringir tratamento por legítimo interesse (gdpr art. 21). a aevia não vende dados,
              mas respeitamos essa objeção como política geral (ccpa §1798.120).
            </li>
            <li>
              <span className="font-mono text-sm text-primary">revisão humana</span> — para decisões
              automatizadas que afetem você significativamente (gdpr art. 22, lgpd art. 20).
              aplicável ao score de risco; você pode solicitar revisão manual.
            </li>
          </ul>
        </section>

        {/* §5 Retenção */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            retenção e minimização
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            logs técnicos: 30 dias. registros de contato (e-mails): 2 anos. registros de dmca e
            contra-notificação: conforme exigência legal (17 u.s.c. §512). ncmec reports: 90 dias
            conforme 18 u.s.c. §2258a(h). deletamos dados que saíram de todas essas janelas.
          </p>
        </section>

        {/* §6 Transferências internacionais */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§6</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            transferências internacionais
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            a aevia é sediada nos estados unidos. dados de usuários do espaço econômico europeu
            transferidos para os estados unidos são protegidos por standard contractual clauses
            (gdpr art. 46(2)(c)). para titulares brasileiros, transferências internacionais dependem
            de cláusulas específicas conforme art. 33 lgpd. atualizaremos este parágrafo se
            aderirmos ao eu–us data privacy framework.
          </p>
        </section>

        {/* §7 Processadores terceirizados */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§7</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            processadores terceirizados
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            a aevia utiliza os seguintes processadores na operação do serviço. cada um tem acordo
            formal de processamento (dpa) e não pode usar os dados para finalidades próprias:
          </p>
          <ul className="mt-6 space-y-3 max-w-[72ch] text-base leading-[1.7]">
            <li>
              <span className="font-mono text-sm text-primary">cloudflare</span> — hospedagem, cdn,
              analytics agregado, email routing. dpa padrão.
            </li>
            <li>
              <span className="font-mono text-sm text-primary">privy</span> — embedded wallet e
              autenticação de criadores. dados: endereço de wallet, e-mail opcional.
            </li>
            <li>
              <span className="font-mono text-sm text-primary">base (coinbase)</span> — rede
              blockchain l2 onde manifestos são ancorados. todas as transações são públicas por
              design.
            </li>
          </ul>
        </section>

        {/* §8 Cookies */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§8</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">cookies</h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            aevia.network usa apenas cookies estritamente necessários (toggle de idioma, sessão
            privy). não há cookies de tracking, publicidade, ou analytics de terceiros. se
            futuramente adicionarmos, o banner de consentimento é exigido (gdpr ePrivacy, lgpd art.
            8).
          </p>
        </section>

        {/* §9 Menores */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§9</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            privacidade de menores
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            conforme a{' '}
            <Link href="/aup" className="text-primary hover:text-primary-dim underline">
              aup §3
            </Link>
            , a aevia não é direcionada a menores de 13 anos (coppa), 16 anos no eee (gdpr art. 8),
            e exige autorização parental para 13–17 no brasil (lgpd art. 14). se descobrirmos dados
            pessoais de menor abaixo da idade aplicável, esses dados são deletados sem necessidade
            de pedido formal.
          </p>
        </section>

        {/* §10 Alterações */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <span className="font-label text-xs text-tertiary tracking-[0.04em]">§10</span>
          <h2 className="mt-2 font-headline text-3xl font-bold leading-tight">
            alterações nesta política
          </h2>
          <p className="mt-4 max-w-[72ch] text-base leading-[1.7]">
            quando alteramos materialmente esta política, atualizamos a versão no topo e publicamos
            um aviso no{' '}
            <Link href="/roadmap" className="text-primary hover:text-primary-dim underline">
              roadmap
            </Link>
            . mudanças que afetem direitos do titular de forma restritiva entram em vigor 30 dias
            após publicação, dando tempo para exercício prévio dos direitos atuais.
          </p>
        </section>

        {/* §11 Contato */}
        <section className="mx-auto mt-24 max-w-[72ch]">
          <div className="rounded-lg border border-primary-dim/30 bg-surface-container-low p-8">
            <span className="font-label text-xs text-tertiary">§11 · contato de privacidade</span>
            <p className="mt-2 max-w-[72ch] text-base text-on-surface-variant leading-[1.7]">
              aevia llc · delaware, usa ·{' '}
              <a
                href="mailto:contact@aevia.network?subject=privacy request"
                className="text-primary hover:text-primary-dim"
              >
                contact@aevia.network
              </a>
              . para reclamações à autoridade de controle: eua — ag do estado de residência; eee —
              autoridade nacional de proteção de dados; brasil — autoridade nacional de proteção de
              dados (anpd).
            </p>
          </div>
        </section>

        <div className="pb-[120px]" />
      </main>
      <Footer />
    </>
  );
}
