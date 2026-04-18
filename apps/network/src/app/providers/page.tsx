import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { MeshDot } from '@aevia/ui';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'provider nodes · aevia.network',
  description:
    'torne-se um provider node da aevia. hospede conteúdo, prove replicação, receba em cusdc.',
};

export default function Providers() {
  return (
    <>
      <Nav locale="pt-BR" />
      <main className="mx-auto max-w-[1440px] px-12">
        {/* Masthead */}
        <section className="pt-[200px]">
          <div className="mx-auto max-w-[72ch] text-center">
            <p className="font-label text-xs text-tertiary tracking-[0.04em]">
              infra · provider nodes
            </p>
            <h1 className="mt-6 font-headline text-[96px] font-bold leading-[1.05] tracking-tight text-accent">
              provider nodes
            </h1>
            <p className="mx-auto mt-8 max-w-[68ch] text-xl text-on-surface-variant leading-[1.7]">
              o protocolo não distribui sem os nós de persistência. se você opera infraestrutura —
              em casa, em datacenter regional, ou em um provedor de confiança — pode ser um.
            </p>
          </div>
        </section>

        {/* Divider */}
        <hr className="mt-24 border-primary-dim/40" />

        {/* Prose lead */}
        <section className="mt-24">
          <div className="mx-auto max-w-[72ch] space-y-6 text-lg leading-[1.7] text-on-surface-variant">
            <p>
              um provider node é um processo go que replica conteúdo endereçado por cid e prova essa
              replicação on-chain em intervalos regulares. o nó recebe cusdc proporcionalmente ao
              uptime, ao tamanho dos objetos hospedados e ao peso da região.
            </p>
            <p>
              você não precisa ser grande. nós esperamos que a maior parte da rede seja composta por
              operadores pequenos — ministérios, coletivos de creators, operadores caseiros com um
              proxmox e uma conexão decente. a redundância vem do número, não do tamanho.
            </p>
          </div>
        </section>

        {/* Three-card grid */}
        <section className="mt-24">
          <div className="mx-auto grid max-w-[92ch] grid-cols-3 gap-8">
            <article className="flex min-h-[260px] flex-col gap-4 rounded-lg border border-primary-dim/30 bg-surface-container-low p-8">
              <p className="font-mono text-xs text-tertiary">01 ·</p>
              <h3 className="font-headline text-2xl font-bold leading-tight text-accent">
                hospeda o conteúdo
              </h3>
              <p className="text-base text-on-surface-variant leading-[1.7]">
                réplicas de conteúdo endereçado por cid. você pode limitar por tamanho total, por
                região de origem, ou por criador/ministério.
              </p>
            </article>

            <article className="flex min-h-[260px] flex-col gap-4 rounded-lg border border-primary-dim/30 bg-surface-container-low p-8">
              <p className="font-mono text-xs text-tertiary">02 ·</p>
              <h3 className="font-headline text-2xl font-bold leading-tight text-accent">
                prova replicação
              </h3>
              <p className="text-base text-on-surface-variant leading-[1.7]">
                o nó responde a desafios de proof-of-replication regularmente. sem prova válida, sem
                pagamento — simples assim.
              </p>
            </article>

            <article className="flex min-h-[260px] flex-col gap-4 rounded-lg border border-primary-dim/30 bg-surface-container-low p-8">
              <p className="font-mono text-xs text-tertiary">03 ·</p>
              <h3 className="font-headline text-2xl font-bold leading-tight text-accent">
                recebe em cusdc
              </h3>
              <p className="text-base text-on-surface-variant leading-[1.7]">
                pagamento automatizado pelo contrato persistence pool em base. saque em cusdc quando
                quiser, câmbio quando precisar.
              </p>
            </article>
          </div>
        </section>

        {/* Waitlist block */}
        <section className="mt-24">
          <div className="mx-auto max-w-[72ch] rounded-lg border border-primary-dim/30 bg-surface-container-low p-10 text-center">
            <h2 className="font-headline text-3xl font-bold leading-tight text-accent">
              aevia não distribui sem provider nodes. seja um.
            </h2>
            <p className="mx-auto mt-4 max-w-[56ch] text-base text-on-surface-variant leading-[1.7]">
              a lista de espera é operada por e-mail. me mande especificação de hardware, faixa de
              banda e região. respondo em dias — um a um, sem newsletter.
            </p>
            <div className="mt-8">
              <a
                href="mailto:contact@aevia.network?subject=Provider Node — interest&body=Especificação de hardware:%0ABanda disponível:%0ARegião:%0ACapacidade de armazenamento:%0AContato:"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-label text-sm text-accent transition-colors hover:bg-primary-dim"
              >
                entrar na waitlist
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </a>
            </div>
            <div className="mt-4">
              <Link
                href="/spec/rfc-5"
                className="inline-flex items-center gap-1 font-label text-sm text-primary-dim hover:text-primary"
              >
                leia rfc-5 persistence pool
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </section>

        {/* Signature line */}
        <section className="mt-16 pb-[160px]">
          <div className="flex items-center justify-center gap-2 font-body text-sm italic text-on-surface-variant">
            <span>&ldquo;a redundância vem do número, não do tamanho.&rdquo;</span>
            <MeshDot />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
