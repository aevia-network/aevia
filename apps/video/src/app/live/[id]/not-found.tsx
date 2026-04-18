import { ArrowLeft, Compass, Radio } from 'lucide-react';
import Link from 'next/link';

export const runtime = 'edge';

/**
 * 404 surface for `/live/[id]` when Cloudflare Stream returns no matching live
 * input (deleted, never existed, or wrong UID). Editorial DS-aligned: no
 * shadcn Button, tonal layering, lowercase pt-BR, two clear next steps.
 */
export default function LiveNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-surface-container">
        <Radio className="size-7 text-on-surface/40" aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <p className="font-label text-[11px] text-on-surface/50 uppercase tracking-[0.2em]">
          erro 404
        </p>
        <h1 className="font-headline font-semibold text-2xl text-on-surface lowercase">
          transmissão não encontrada
        </h1>
        <p className="font-body text-on-surface/60 text-sm">
          esta transmissão não existe ou foi apagada pelo criador. o conteúdo on-chain — quando
          ancorado — permanece referenciável; mas a sessão de stream encerrou.
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/feed"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 font-label font-medium text-on-primary text-xs lowercase transition-opacity hover:opacity-90"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          voltar ao feed
        </Link>
        <Link
          href="/discover"
          className="inline-flex items-center gap-1.5 rounded-md bg-surface-container px-4 py-2 font-label font-medium text-on-surface/80 text-xs lowercase transition-colors hover:bg-surface-high hover:text-on-surface"
        >
          <Compass className="size-3.5" aria-hidden />
          descobrir o que está no ar
        </Link>
      </div>
    </main>
  );
}
