// ReactionStrip — fixed 6-chip row expressing Aevia's reaction vocabulary.

import { Bookmark, Gift, HandHelping, HeartHandshake, Share2, Zap } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../lib/cn';

/**
 * ReactionStrip — six fixed chips expressing Aevia's reaction vocabulary.
 *
 * The vocabulary is intentional and NOT configurable. It maps to the social
 * primitives the platform surfaces: `amem` (agreement/amen), `orar` (pray),
 * `boost` (amplify), `salvar` (bookmark), `apoiar` (support via credits),
 * `compartilhar` (share). Order is fixed.
 *
 * Usage:
 *
 * ```tsx
 * <ReactionStrip
 *   active={['amem']}
 *   counts={{ amem: 128, boost: 7 }}
 *   onReact={(kind) => toggleReaction(kind)}
 * />
 * ```
 *
 * Non-obvious tokens consumed:
 * - `bg-primary-container` / `text-on-primary-container` — active chip.
 * - `bg-surface-container-high` / `text-on-surface` — inactive chip.
 */

export type ReactionKind = 'amem' | 'orar' | 'boost' | 'salvar' | 'apoiar' | 'compartilhar';

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

const ORDER: readonly ReactionKind[] = [
  'amem',
  'orar',
  'boost',
  'salvar',
  'apoiar',
  'compartilhar',
];

const ICONS: Record<ReactionKind, React.ComponentType<{ className?: string }>> = {
  amem: HeartHandshake,
  orar: HandHelping,
  boost: Zap,
  salvar: Bookmark,
  apoiar: Gift,
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
