import { Footer } from '@/components/footer';
import { Nav } from '@/components/nav';
import { MeshDot } from '@aevia/ui';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <>
      <Nav locale="pt-BR" />
      <main className="mx-auto flex min-h-[70vh] max-w-[1440px] items-center justify-center px-12">
        <div className="flex max-w-[56ch] flex-col items-center gap-6 text-center">
          <p className="font-mono text-sm tracking-[0.04em] text-tertiary">
            404 · página não encontrada
          </p>

          <h1 className="font-headline text-6xl font-bold leading-[1.1] tracking-tight">
            ou você a perdeu, ou ela nunca existiu.
          </h1>

          <p className="max-w-[48ch] text-lg leading-[1.7] text-on-surface-variant">
            o protocolo aevia indexa apenas o que foi canonicamente assinado. se você seguiu um link
            de fora para uma rota que não está na spec, é provável que a rota tenha mudado de nome
            antes de ser oficial.
          </p>

          <div className="mt-4 flex items-center gap-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-label text-base text-primary transition-colors hover:text-primary-dim"
            >
              voltar para o início
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
            <Link
              href="/spec"
              className="inline-flex items-center gap-2 font-label text-base text-primary transition-colors hover:text-primary-dim"
            >
              ir para a spec
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </div>

          <div className="mt-12 flex items-center gap-2 font-body text-sm italic text-on-surface-variant">
            <span>&ldquo;persistência não implica distribuição.&rdquo;</span>
            <MeshDot />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
