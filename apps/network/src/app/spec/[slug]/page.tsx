import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-static';
export const dynamicParams = false;

const SLUGS = ['rfc-0', 'rfc-1', 'rfc-2', 'rfc-3', 'rfc-4', 'rfc-5'] as const;
type Slug = (typeof SLUGS)[number];

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

const RFCS: Record<Slug, { title: string; eyebrow: string; updated: string }> = {
  'rfc-0': {
    title: 'visão geral do protocolo',
    eyebrow: 'rfc-0 · overview',
    updated: '2026-04-14',
  },
  'rfc-1': { title: 'manifest schema', eyebrow: 'rfc-1 · schema', updated: '2026-04-15' },
  'rfc-2': { title: 'content addressing', eyebrow: 'rfc-2 · addressing', updated: '2026-04-15' },
  'rfc-3': { title: 'autenticação e assinatura', eyebrow: 'rfc-3 · auth', updated: '2026-04-16' },
  'rfc-4': { title: 'acceptable use policy', eyebrow: 'rfc-4 · aup', updated: '2026-04-16' },
  'rfc-5': { title: 'persistence pool', eyebrow: 'rfc-5 · persistence', updated: '2026-04-16' },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const rfc = RFCS[slug as Slug];
  if (!rfc) return { title: 'spec · aevia.network' };
  return {
    title: `${rfc.eyebrow} · aevia.network`,
    description: `rfc normativo: ${rfc.title}.`,
  };
}

export default async function SpecSlug({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const rfc = RFCS[slug as Slug];
  if (!rfc) notFound();

  return (
    <>
      <Nav active="spec" locale="pt-BR" />
      <main className="mx-auto max-w-[1440px] px-12">
        <div className="grid grid-cols-[280px_minmax(0,92ch)_1fr] gap-16 pt-[200px] pb-24">
          {/* Left — sticky TOC */}
          <aside className="sticky top-[100px] self-start flex flex-col gap-3">
            <span className="font-label text-xs text-tertiary tracking-[0.04em]">na página</span>
            <a
              href="#escopo"
              className="font-label text-sm text-on-surface-variant hover:text-accent"
            >
              §1 · escopo
            </a>
            <a
              href="#terminologia"
              className="font-label text-sm text-on-surface-variant hover:text-accent"
            >
              §2 · terminologia
            </a>
            <a
              href="#exclusoes"
              className="font-label text-sm text-on-surface-variant hover:text-accent"
            >
              §3 · exclusões
            </a>
            <a
              href="#cumprimento"
              className="font-label text-sm text-on-surface-variant hover:text-accent"
            >
              §4 · cumprimento
            </a>
            <a
              href="#referencias"
              className="font-label text-sm text-on-surface-variant hover:text-accent"
            >
              §5 · referências
            </a>
            <div className="h-12" />
            <a href="/spec" className="font-label text-sm text-primary hover:text-primary-dim">
              ← voltar ao índice
            </a>
          </aside>

          {/* Middle — prose */}
          <article>
            {/* Masthead */}
            <header>
              <span className="font-label text-xs text-tertiary tracking-[0.04em]">
                {rfc.eyebrow}
              </span>
              <h1 className="font-headline text-[72px] font-bold leading-[1.1] tracking-tight mt-4">
                {rfc.title}
              </h1>
              <p className="font-mono text-sm text-on-surface-variant mt-8">
                versão 0.1 · atualizado {rfc.updated} · status: publicado
              </p>
            </header>

            <hr className="my-16 h-px border-0 bg-primary-dim/40" />

            {/* §1 escopo */}
            <section id="escopo" className="py-12">
              <span className="font-label text-xs text-tertiary tracking-[0.04em]">§1</span>
              <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
                escopo
              </h2>
              <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
                <p>
                  este documento define [escopo do rfc, ex: a política de uso aceitável da aevia, ou
                  o schema canônico de manifesto]. aplica-se a todos os clientes e provider nodes do
                  protocolo.
                </p>
                <p>
                  as palavras-chave <span className="font-mono text-primary not-italic">MUST</span>,{' '}
                  <span className="font-mono text-primary not-italic">SHOULD</span> e{' '}
                  <span className="font-mono text-primary not-italic">MAY</span> neste documento são
                  interpretadas conforme rfc 2119.
                </p>
              </div>
            </section>

            {/* §2 terminologia */}
            <section id="terminologia" className="py-12">
              <span className="font-label text-xs text-tertiary tracking-[0.04em]">§2</span>
              <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
                terminologia
              </h2>
              <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
                <p>
                  os termos abaixo são usados ao longo do rfc com o significado aqui estabelecido.
                </p>
                <dl>
                  <dt className="font-mono text-sm text-primary">manifest</dt>
                  <dd className="mt-1 mb-4 text-on-surface-variant">
                    documento json assinado que descreve um conteúdo
                  </dd>
                  <dt className="font-mono text-sm text-primary">cid</dt>
                  <dd className="mt-1 mb-4 text-on-surface-variant">
                    content identifier derivado do hash sha-256 do conteúdo
                  </dd>
                  <dt className="font-mono text-sm text-primary">provider node</dt>
                  <dd className="mt-1 mb-4 text-on-surface-variant">
                    agente que replica e serve conteúdo mediante pagamento
                  </dd>
                  <dt className="font-mono text-sm text-primary">persistence pool</dt>
                  <dd className="mt-1 mb-4 text-on-surface-variant">
                    tesouraria que remunera provider nodes em cusdc
                  </dd>
                </dl>
              </div>
            </section>

            {/* §3 exclusões */}
            <section id="exclusoes" className="py-12">
              <span className="font-label text-xs text-tertiary tracking-[0.04em]">§3</span>
              <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
                exclusões
              </h2>
              <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
                <p>
                  o protocolo não subsidia, não amplifica e não indexa os seguintes tipos de
                  conteúdo — eles podem existir no ipfs raw mas não recebem cheque, feed ou ranking.
                </p>
                <ol className="list-decimal pl-6 font-label text-sm text-on-surface-variant space-y-2 max-w-[72ch]">
                  <li>pornografia e conteúdo sexualmente explícito</li>
                  <li>
                    qualquer sexualização de menores (tolerância zero absoluta; reporte a ncmec)
                  </li>
                  <li>apologia celebratória de violência</li>
                  <li>material que sexualiza pessoas sem consentimento</li>
                  <li>apologia de práticas ocultistas ou satanismo</li>
                </ol>
              </div>
            </section>

            {/* §4 cumprimento */}
            <section id="cumprimento" className="py-12">
              <span className="font-label text-xs text-tertiary tracking-[0.04em]">§4</span>
              <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
                cumprimento
              </h2>
              <div className="mt-6 flex flex-col gap-5 text-lg leading-[1.7] max-w-[72ch]">
                <p>
                  o cumprimento é multi-camada. o protocolo faz o primeiro corte via score de risco
                  calculado off-chain. o conselho tem direito de veto sobre parâmetros, mas não
                  sobre bits existentes no ipfs.
                </p>
                <p>
                  takedowns dmca seguem 17 u.s.c. §512. o agente designado recebe notificações em
                  contact@aevia.network. o procedimento respeita a janela de contra-notificação de
                  10–14 dias úteis.
                </p>
              </div>
            </section>

            {/* §5 referências */}
            <section id="referencias" className="py-12">
              <span className="font-label text-xs text-tertiary tracking-[0.04em]">§5</span>
              <h2 className="mt-2 font-headline text-4xl font-bold leading-tight tracking-tight">
                referências
              </h2>
              <div className="mt-6 max-w-[72ch]">
                <ol className="list-decimal pl-6 font-mono text-sm text-on-surface-variant space-y-2">
                  <li>IETF RFC 2119</li>
                  <li>IPFS Whitepaper — Benet (2014)</li>
                  <li>EIP-712 — Typed structured data</li>
                  <li>DMCA §512 (17 U.S.C.)</li>
                  <li>Section 230 (47 U.S.C. §230)</li>
                </ol>
              </div>
            </section>
          </article>

          {/* Right — breathing room */}
          <div />
        </div>
      </main>
      <Footer />
    </>
  );
}
