// FloatingBoostButton — 56 px Creamy Gold FAB reserved for the "dar boost" action.

import { Zap } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * FloatingBoostButton — circular FAB for applying a credit boost.
 *
 * Always rendered in the Creamy Gold (`secondary`) palette because boosting
 * belongs to the economy surface — this is the single place in the consumer
 * chrome where secondary is sanctioned. The button exposes a small badge at
 * the top-right when `count > 0`.
 *
 * Usage:
 *
 * ```tsx
 * <FloatingBoostButton
 *   count={3}
 *   onBoost={() => openBoostSheet()}
 * />
 * ```
 *
 * Default `aria-label` is "dar boost".
 */
export interface FloatingBoostButtonProps {
  /** Counter badge shown at top-right when boosts applied > 0. */
  count?: number;
  /** Called when user taps the button. */
  onBoost?: () => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

function formatCount(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export function FloatingBoostButton({
  count,
  onBoost,
  disabled = false,
  className,
  'aria-label': ariaLabel = 'dar boost',
}: FloatingBoostButtonProps) {
  const hasCount = typeof count === 'number' && count > 0;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onBoost}
      className={cn(
        'relative inline-flex size-14 items-center justify-center rounded-full',
        'bg-secondary text-on-secondary shadow-lg',
        'transition-transform',
        disabled ? 'cursor-not-allowed opacity-50' : 'active:scale-90',
        'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        className,
      )}
    >
      <Zap className="size-6" />
      {hasCount && (
        <span
          aria-hidden
          className="-top-1 -right-1 absolute rounded-full bg-primary-container px-1.5 py-0.5 font-label font-semibold text-[10px] text-on-primary-container"
        >
          {formatCount(count as number)}
        </span>
      )}
    </button>
  );
}
