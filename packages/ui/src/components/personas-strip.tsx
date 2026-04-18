// PersonasStrip — horizontal scroller advertising the 8 canonical Aevia
// personas. Mirrors `landing.personas` from `apps/network/src/i18n/dict/pt-BR.ts`
// so the consumer app and the marketing site present the same TAM. Used in
// `apps/video` on `/feed` (or `/sign-in`) to make a first-time viewer
// understand "this is for me" within a single horizontal swipe.

import { cn } from '../lib/cn';

export interface PersonaChip {
  /** Slug shown in the chip badge. Lowercase, short. */
  tag: string;
  /** One-line description; echoes the `landing.personas` blurbs. */
  line: string;
}

export interface PersonasStripProps {
  /** Title rendered above the strip. Optional. */
  heading?: string;
  /** Lead sentence below the title. Optional. */
  lead?: string;
  /** The 8 personas; defaults to `DEFAULT_PERSONAS` (canonical list). */
  personas?: readonly PersonaChip[];
  className?: string;
}

/**
 * Canonical 8 personas from `aevia.network` `landing.personas` (pt-BR dict).
 * Order is intentional: secular and faith-aligned interleaved so no half of
 * the strip reads as "the niche half". Update both this list AND the network
 * dict together when adding/removing a persona.
 */
export const DEFAULT_PERSONAS: readonly PersonaChip[] = [
  {
    tag: 'gamer',
    line: 'streams, playthroughs, tutoriais, clipes. seu canal continua seu, não do algoritmo.',
  },
  {
    tag: 'jornalista local',
    line: 'cobertura de cidade, conselho municipal, desastre climático. sem dependência de cdn comercial que muda regra da noite pro dia.',
  },
  {
    tag: 'educador',
    line: 'aulas, palestras, cursos. sua biblioteca persiste mesmo quando a plataforma muda política.',
  },
  {
    tag: 'documentarista',
    line: 'longa duração, séries, investigações. moderação editorial pública, não opaca.',
  },
  {
    tag: 'maker / artesão',
    line: 'tutoriais, workshops, produtos. audiência portável por cid, não por handle.',
  },
  {
    tag: 'músico indie',
    line: 'seu catálogo, suas regras. demonetização arbitrária não existe aqui.',
  },
  {
    tag: 'ministério / apologista',
    line: 'ensino, testemunho, estudo bíblico. seu trabalho protegido pela aup, não sujeito a viés de moderação.',
  },
  {
    tag: 'comunidade local',
    line: 'ong, coletivo, cooperativa. ferramenta de mídia sem depender de corporate cloud.',
  },
];

/**
 * Horizontal snap-scroller of persona cards. Each card is `bg-surface-container`
 * (no border — respects the No-Line rule), `min-w-[260px]`, snap-start.
 * Scrollbar hidden via `[&::-webkit-scrollbar]:hidden` to match the live-now
 * strip in the home feed.
 */
export function PersonasStrip({
  heading = 'pra quem é isso',
  lead = 'aevia é pra quem cria e quer persistir. a aup exclui o que comunidades saudáveis já excluem (csam, ncii, apologia de violência). o resto do mundo criador cabe aqui.',
  personas = DEFAULT_PERSONAS,
  className,
}: PersonasStripProps) {
  return (
    <section aria-labelledby="personas-heading" className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-2">
        <h2
          id="personas-heading"
          className="font-headline font-semibold text-on-surface text-xl lowercase"
        >
          {heading}
        </h2>
        <p className="font-body text-on-surface/60 text-sm">{lead}</p>
      </div>

      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {personas.map((p) => (
          <li
            key={p.tag}
            className="w-[260px] shrink-0 snap-start rounded-md bg-surface-container p-4"
          >
            <span className="inline-flex items-center rounded-full bg-surface-high px-2.5 py-1 font-label font-medium text-[11px] text-on-surface/80 lowercase">
              {p.tag}
            </span>
            <p className="mt-3 font-body text-on-surface/70 text-sm leading-snug">{p.line}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
