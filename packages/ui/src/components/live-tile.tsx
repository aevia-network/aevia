// LiveTile — 16:9 card for live/VOD content; the only DS component with a solid 2 px border.

import type * as React from 'react';
import { cn } from '../lib/cn';

/**
 * LiveTile — 16:9 thumbnail card for a live stream or VOD.
 *
 * This is the single sanctioned exception to the No-Line rule: when `live` is
 * true, the tile renders a solid 2 px `primary-dim` border. All other tiles in
 * the DS rely on tonal layering (`bg-surface-container`).
 *
 * Usage — clickable tile with Next routing:
 *
 * ```tsx
 * import Link from 'next/link';
 * import { LiveTile } from '@aevia/ui';
 *
 * <Link href={`/live/${uid}`} legacyBehavior>
 *   <LiveTile thumbnailUrl={url} live viewers={137} aria-label={title}>
 *     <p className="font-medium text-sm">{title}</p>
 *   </LiveTile>
 * </Link>
 * ```
 *
 * The `href` prop is provided as a convenience for non-Next consumers (plain
 * anchor). `@aevia/ui` cannot import `next/link` without coupling.
 *
 * Non-obvious tokens consumed:
 * - `border-primary-dim` — the Verdigris variant reserved for this component.
 * - `bg-surface-container` / `bg-surface-container-high` — tonal surfaces.
 * - `bg-primary-container` + `text-on-primary-container` — "ao vivo" chip.
 * - `.aevia-mesh-pulse` keyframes — declared in `src/styles.css`.
 */
export interface LiveTileProps {
  /** Thumbnail image URL. If omitted, renders a dark placeholder. */
  thumbnailUrl?: string;
  /** Alt text for the thumbnail. Required when thumbnailUrl is present. */
  thumbnailAlt?: string;
  /** Whether the content is currently live. Drives the "ao vivo" chip + border colour. */
  live?: boolean;
  /** Optional duration label in "m:ss" for VODs. Ignored when `live` is true. */
  duration?: string;
  /** Number of current viewers. Rendered when `live` is true. */
  viewers?: number;
  /** Accessible label for the whole tile — typically the video title. */
  'aria-label'?: string;
  /** Optional children render below the thumbnail (title, meta row, etc.). */
  children?: React.ReactNode;
  /** If provided, wraps the tile in a plain anchor. For Next routing, wrap the tile in `<Link>` instead. */
  href?: string;
  className?: string;
}

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export function LiveTile({
  thumbnailUrl,
  thumbnailAlt,
  live = false,
  duration,
  viewers,
  'aria-label': ariaLabel,
  children,
  href,
  className,
}: LiveTileProps) {
  const tile = (
    <article aria-label={ariaLabel} className={cn('group flex flex-col', className)}>
      <div
        className={cn(
          'relative aspect-video w-full overflow-hidden rounded-md bg-surface-container',
          live && 'border-2 border-primary-dim',
        )}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={thumbnailAlt ?? ''}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-container-high">
            <span className="font-label text-[11px] text-on-surface/30 lowercase">
              sem pré-visualização
            </span>
          </div>
        )}

        {live && (
          <span
            className={cn(
              'absolute top-2 left-2 inline-flex items-center rounded-sm px-1.5 py-0.5',
              'bg-primary-container text-on-primary-container',
              'font-label text-[8px] font-medium uppercase tracking-wider',
            )}
          >
            ao vivo
          </span>
        )}

        {!live && duration && (
          <span className="absolute right-2 bottom-2 rounded-sm bg-black/80 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {duration}
          </span>
        )}

        {live && typeof viewers === 'number' && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-sm bg-black/80 px-1.5 py-0.5 font-label text-[10px] text-white">
            <span aria-hidden className="aevia-live-pulse" />
            {formatViewers(viewers)} assistindo
          </span>
        )}
      </div>

      {children && <div className="mt-3 flex flex-col gap-2">{children}</div>}
    </article>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {tile}
      </a>
    );
  }

  return tile;
}
