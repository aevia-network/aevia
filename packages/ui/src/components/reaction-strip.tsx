// ReactionStrip — three protocol-weighted chips expressing Aevia's reaction vocabulary.

import { Bookmark, Share2, Zap } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../lib/cn';

/**
 * ReactionStrip — three fixed chips, one per protocol dimension Aevia surfaces.
 *
 * The vocabulary is intentional and NOT configurable. Every reaction carries
 * a load-bearing protocol primitive — there are no "empty likes". The set:
 *
 *   - `boost`        — economic.    RFC-8 §4 BoostRouter (non-custodial 4-way
 *                                   split: creator + persistence pool +
 *                                   council fund + LLC treasury).
 *   - `salvar`       — persistente. RFC-3 PersistencePool (each save = one
 *                                   peer holding the content; carries
 *                                   replication factor for the manifest).
 *   - `compartilhar` — distributivo. RFC-9 discovery (off-chain propagation
 *                                   signal feeding ranking / feed surfacing).
 *
 * Earlier iterations included `amem` / `orar` (Christian-explicit) and
 * `apoiar` (semantic dup of `boost`); both were dropped during the
 * generalist reframe (TODO §15) so the UI matches the universal-TAM stance
 * of aevia.network. Order is fixed.
 *
 * Usage:
 *
 * ```tsx
 * <ReactionStrip
 *   active={['boost']}
 *   counts={{ boost: 128, salvar: 12 }}
 *   onReact={(kind) => toggleReaction(kind)}
 * />
 * ```
 *
 * Non-obvious tokens consumed:
 * - `bg-primary-container` / `text-on-primary-container` — active chip.
 * - `bg-surface-container-high` / `text-on-surface` — inactive chip.
 */

export type ReactionKind = 'boost' | 'salvar' | 'compartilhar';

export interface ReactionStripProps {
  /** Current set of reactions the viewer has already applied. */
  active?: readonly ReactionKind[];
  /** Counts per reaction to display. Missing kinds render without a count. */
  counts?: Partial<Record<ReactionKind, number>>;
  /** Called when the user toggles a reaction. */
  onReact?: (kind: ReactionKind) => void;
  /** Disables all chips (loading / not signed in). */
  disabled?: boolean;
  className?: string;
}

const ORDER: readonly ReactionKind[] = ['boost', 'salvar', 'compartilhar'];

const ICONS: Record<ReactionKind, React.ComponentType<{ className?: string }>> = {
  boost: Zap,
  salvar: Bookmark,
  compartilhar: Share2,
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export function ReactionStrip({
  active,
  counts,
  onReact,
  disabled = false,
  className,
}: ReactionStripProps) {
  const activeSet = new Set<ReactionKind>(active ?? []);

  return (
    <section
      aria-label="reações"
      className={cn(
        'flex gap-2',
        disabled && 'pointer-events-none cursor-not-allowed opacity-40',
        className,
      )}
    >
      {ORDER.map((kind) => {
        const Icon = ICONS[kind];
        const isActive = activeSet.has(kind);
        const count = counts?.[kind];
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={isActive}
            aria-label={kind}
            disabled={disabled}
            onClick={() => onReact?.(kind)}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3',
              'font-label text-xs lowercase transition-colors',
              isActive
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container-high text-on-surface hover:bg-surface-highest',
              'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
            )}
          >
            <Icon className="size-5" />
            <span>{kind}</span>
            {typeof count === 'number' && count > 0 && (
              <span className="font-mono text-[11px] tabular-nums">{formatCount(count)}</span>
            )}
          </button>
        );
      })}
    </section>
  );
}
