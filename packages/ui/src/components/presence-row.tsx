// PresenceRow — 24 px overlapped avatar row with an optional overflow chip.

import { cn } from '../lib/cn';

/**
 * PresenceRow — overlapped avatar stack signalling "N others watching".
 *
 * Renders up to `maxVisible` 24 px circular avatars, each with a
 * `ring-2 ring-surface-container` separator. When `total > maxVisible`, an
 * appended chip shows `+{remaining} {label}` (default label
 * "assistindo juntos"). Returns `null` when the viewers array is empty.
 *
 * Usage:
 *
 * ```tsx
 * <PresenceRow
 *   viewers={[
 *     { id: '1', name: 'Lucas Andrade', avatarUrl: '/a.jpg' },
 *     { id: '2', name: 'Marina Pires' },
 *   ]}
 *   total={42}
 * />
 * ```
 */

export interface PresenceRowViewer {
  id: string;
  /** Avatar image URL. If missing, renders initials derived from `name`. */
  avatarUrl?: string;
  name: string;
}

export interface PresenceRowProps {
  /** Avatars to display. Pass up to `maxVisible` — additional count rolls into the overflow chip. */
  viewers: readonly PresenceRowViewer[];
  /** Maximum visible avatars before the overflow chip shows. Default 5. */
  maxVisible?: number;
  /** Total count override. If omitted, uses `viewers.length`. */
  total?: number;
  /** Optional copy appended after the chip. Default: "assistindo juntos". */
  label?: string;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return (first + last).toUpperCase();
}

export function PresenceRow({
  viewers,
  maxVisible = 5,
  total,
  label = 'assistindo juntos',
  className,
}: PresenceRowProps) {
  if (viewers.length === 0) return null;

  const visible = viewers.slice(0, maxVisible);
  const effectiveTotal = typeof total === 'number' ? total : viewers.length;
  const remaining = Math.max(0, effectiveTotal - maxVisible);

  return (
    <section aria-label="outros assistindo" className={cn('flex items-center', className)}>
      <div className="flex items-center">
        {visible.map((viewer, idx) => (
          <div
            key={viewer.id}
            className={cn(
              'relative size-6 shrink-0 overflow-hidden rounded-full ring-2 ring-surface-container',
              idx === 0 ? 'ml-0' : '-ml-2',
            )}
            title={viewer.name}
          >
            {viewer.avatarUrl ? (
              <img
                src={viewer.avatarUrl}
                alt={viewer.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span
                aria-label={viewer.name}
                className="flex h-full w-full items-center justify-center bg-primary-container font-label font-medium text-[9px] text-on-primary"
              >
                {initials(viewer.name)}
              </span>
            )}
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <span className="ml-3 font-label text-xs text-on-surface/60 lowercase">
          +{remaining} {label}
        </span>
      )}
    </section>
  );
}
