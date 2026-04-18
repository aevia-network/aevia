import { BottomNav } from '@/components/bottom-nav';
import { ArrowLeft, ArrowUpRight, Check, X } from 'lucide-react';
import Link from 'next/link';

export const runtime = 'edge';
export const revalidate = 3600;

/**
 * /aup — public Acceptable Use Policy summary surface. Sprint 2 placeholder
 * until the full v0.1 lands in `docs/aup/` (TODO §6). Renders the hard
 * exclusions and the "what we incentivize" half so every viewer/creator can
 * read the rules before signing in or going live, and so the 4 in-app links
 * (`signin-screen`, `trust-screen` ×2, `go-live-screen`) resolve cleanly.
 */
export default function AupPage() {
  return (
    <div className="min-h-screen pb-28">
      <TopChrome />

      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 pt-6 pb-10">
        <Hero />
        <ThesisCallout />
        <ExclusionsList />
        <IncentivesList />
        <ProcessNote />
        <FullPolicyLink />
      </main>

      <BottomNav />
    </div>
  );
}

// ---- Top chrome (harmonized) ---------------------------------------------

function TopChrome() {
  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center bg-surface-container-low/90 px-4 backdrop-blur-[12px]">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/feed"
            aria-label="voltar ao feed"
            className="rounded-full p-2 text-on-surface/70 transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="font-headline font-semibold text-base text-on-surface lowercase">
            política de uso aceitável
          </h1>
        </div>
        <span className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
          v0.1 · esboço
        </span>
      </div>
    </header>
  );
}

// ---- Hero ----------------------------------------------------------------

function Hero() {
  return (
    <section aria-labelledby="aup-hero" className="flex flex-col gap-3">
      <p className="font-label text-[11px] text-on-surface/50 uppercase tracking-[0.2em]">
        aevia · acceptable use policy
      </p>
      <h2
        id="aup-hero"
        className="font-headline font-semibold text-[28px] text-on-surface leading-[1.1] lowercase"
      >
        o que esta rede não hospeda — e o que ela protege
      </h2>
      <p className="font-body text-on-surface/60 text-sm">
        a aup define o que a aevia incentiva financeiramente (pinning subsidiado, ranking,
        recomendação) e o que ela exclui de qualquer subsídio, mesmo quando o conteúdo permanece
        publicamente acessível via ipfs.
      </p>
    </section>
  );
}

// ---- Thesis callout ------------------------------------------------------

function ThesisCallout() {
  return (
    <section aria-label="tese" className="rounded-md bg-surface-container p-5">
      <p className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
        princípio
      </p>
      <p className="mt-2 font-headline font-semibold text-on-surface text-xl leading-snug lowercase">
        persistência ≠ distribuição.
      </p>
      <p className="mt-3 font-body text-on-surface/70 text-sm leading-relaxed">
        registrar bits no protocolo é permanente. distribuir (feed, ranking, promoção, recomendação)
        é regulado fora da cadeia, com base no score de risco e governança transparente. esta
        política governa incentivos, não a existência de bits no ipfs.
      </p>
    </section>
  );
}

// ---- Hard exclusions -----------------------------------------------------

const EXCLUSIONS: Array<{ title: string; detail: string }> = [
  {
    title: 'pornografia e conteúdo sexualmente explícito',
    detail: 'sem subsídio de pinning, sem boost de ranking, sem destaque editorial.',
  },
  {
    title: 'plataformas de trabalho sexual',
    detail: 'mesmas regras: nada de incentivo financeiro pago pela aevia.',
  },
  {
    title: 'qualquer sexualização de menores',
    detail:
      'tolerância zero absoluta. denúncia ao ncmec e remoção imediata de toda camada de subsídio.',
  },
  {
    title: 'apologia celebratória do aborto',
    detail: 'não confundir com testemunho pós-aborto, doutrina ou debate teológico — esses ficam.',
  },
  {
    title: 'ocultismo, satanismo e bruxaria como prática',
    detail: 'estudo histórico/acadêmico permanece — a prática promocional não.',
  },
  {
    title: 'apologia de drogas',
    detail: 'redução de danos e testemunho de recuperação ficam — promoção de uso, não.',
  },
  {
    title: 'discurso de ódio acionável contra qualquer grupo',
    detail: 'inclui ódio anti-cristão, antissemita, racista — sem exceção por "lado político".',
  },
  {
    title: 'apologia de violência',
    detail: 'documentação jornalística de violência permanece — celebração ou incitação não.',
  },
];

function ExclusionsList() {
  return (
    <section aria-labelledby="exclusions" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h3
          id="exclusions"
          className="font-headline font-semibold text-xl text-on-surface lowercase"
        >
          o que a aevia não subsidia
        </h3>
        <span className="font-label text-[10px] text-danger/80 uppercase tracking-wider">
          hard exclusions
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {EXCLUSIONS.map((e) => (
          <li key={e.title} className="flex items-start gap-3 rounded-md bg-surface-container p-4">
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-danger/15">
              <X className="size-3 text-danger" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-headline font-medium text-on-surface text-sm lowercase">
                {e.title}
              </span>
              <span className="font-body text-[12px] text-on-surface/60 leading-relaxed">
                {e.detail}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- Incentives ----------------------------------------------------------

const INCENTIVES: Array<{ title: string; detail: string }> = [
  {
    title: 'voz de criadores silenciados',
    detail: 'jornalistas, apologetas, ministérios e educadores deplatformados em outras redes.',
  },
  {
    title: 'pinning subsidiado em provider nodes',
    detail: 'conteúdo aprovado pela aup recebe replicação paga em cusdc na rede de provedores.',
  },
  {
    title: 'distribuição editorial curada',
    detail: 'ranking e descoberta favorecem permanência ética e densidade de fé sobre engajamento.',
  },
  {
    title: 'transparência de moderação',
    detail: 'todo voto do conselho é público on-chain, com voto majoritário e minoritário.',
  },
];

function IncentivesList() {
  return (
    <section aria-labelledby="incentives" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h3
          id="incentives"
          className="font-headline font-semibold text-xl text-on-surface lowercase"
        >
          o que a aevia protege e financia
        </h3>
        <span className="font-label text-[10px] text-tertiary uppercase tracking-wider">
          subsidiado
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {INCENTIVES.map((i) => (
          <li key={i.title} className="flex items-start gap-3 rounded-md bg-surface-container p-4">
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-tertiary/15">
              <Check className="size-3 text-tertiary" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-headline font-medium text-on-surface text-sm lowercase">
                {i.title}
              </span>
              <span className="font-body text-[12px] text-on-surface/60 leading-relaxed">
                {i.detail}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- Process note --------------------------------------------------------

function ProcessNote() {
  return (
    <section aria-label="processo" className="rounded-md bg-surface-dim p-5">
      <p className="font-label text-[10px] text-on-surface/50 uppercase tracking-[0.15em]">
        processo
      </p>
      <p className="mt-2 font-body text-on-surface/70 text-sm leading-relaxed">
        contestações são revisadas por um conselho de 11 membros multi-denominacional + secular, com
        mandatos de 6 meses e voto registrado on-chain. quatro desfechos possíveis:{' '}
        <span className="text-tertiary">mantido</span>,{' '}
        <span className="text-secondary">desindexado da descoberta</span>,{' '}
        <span className="text-secondary">apenas raw mesh</span>,{' '}
        <span className="text-danger">removido do pinning subsidiado</span>. apelação em até 30 dias
        por conselho expandido.
      </p>
    </section>
  );
}

// ---- Full policy link ----------------------------------------------------

function FullPolicyLink() {
  return (
    <section
      aria-label="política completa"
      className="flex flex-col gap-2 rounded-md border border-surface-container-high/30 bg-surface-lowest p-5"
    >
      <span className="font-label text-[10px] text-tertiary uppercase tracking-widest">
        política completa
      </span>
      <p className="font-body text-on-surface/70 text-sm">
        a v0.1 normativa em pt-BR + en está sendo redigida em{' '}
        <span className="font-mono text-on-surface/80">docs/aup/</span> e será publicada antes do
        sprint 3.
      </p>
      <a
        href="https://github.com/Leeaandrob/videoengine/tree/main/docs/aup"
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex items-center gap-1.5 font-label text-primary-dim text-sm lowercase hover:text-primary"
      >
        acompanhar no repositório
        <ArrowUpRight className="size-3.5" aria-hidden />
      </a>
    </section>
  );
}
