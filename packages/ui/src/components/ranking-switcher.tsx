// RankingSwitcher — three-pill control that selects the feed ranking template.

import { cn } from '../lib/cn';

/**
 * RankingSwitcher — three-pill radiogroup for the feed ranking template.
 *
 * Three ranking templates ship by default (the underlying R(c) weights are
 * identical; what changes is the surface emphasis):
 * - `comunidade` — family-/community-safe weighting, highest R_values
 *   threshold; suitable for shared screens and classroom contexts.
 * - `padrao` — default balance across editorial dimensions.
 * - `foco` — narrow-topic weighting; viewer follows a chosen domain
 *   (theology, journalism, education, etc.) without cross-feed dilution.
 *
 * This component is strictly controlled — the consumer owns `value`.
 *
 * Usage:
 *
 * ```tsx
 * const [template, setTemplate] = useState<RankingTemplate>('padrao');
 * <RankingSwitcher value={template} onChange={setTemplate} />
 * ```
 */

export type RankingTemplate = 'comunidade' | 'padrao' | 'foco';

export interface RankingSwitcherProps {
  value: RankingTemplate;
  onChange: (next: RankingTemplate) => void;
  disabled?: boolean;
  className?: string;
}

const OPTIONS: readonly { kind: RankingTemplate; label: string }[] = [
  { kind: 'comunidade', label: 'comunidade' },
  { kind: 'padrao', label: 'padrão' },
  { kind: 'foco', label: 'foco' },
];

export function RankingSwitcher({
  value,
  onChange,
  disabled = false,
  className,
}: RankingSwitcherProps) {
  return (
    <div
      role="radiogroup"
      aria-label="filtro de ranking"
      className={cn(
        'inline-flex gap-1 rounded-full bg-surface-container p-1',
        disabled && 'pointer-events-none cursor-not-allowed opacity-40',
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const isActive = value === opt.kind;
        return (
          <button
            key={opt.kind}
            type="button"
            // biome-ignore lint/a11y/useSemanticElements: ARIA-APG "Radio Group" pattern — <input type="radio"> cannot be styled as a pill reliably.
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange(opt.kind)}
            className={cn(
              'h-8 rounded-full px-4 font-label font-medium text-sm lowercase transition-colors',
              isActive ? 'bg-primary text-on-primary' : 'text-on-surface/60 hover:text-on-surface',
              'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
