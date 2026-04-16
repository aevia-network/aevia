import { cn } from '../lib/cn';

export type PermanenceLayer = 'mesh' | 'providers' | 'edge' | 'cold';

export interface PermanenceStripProps {
  /** Which Waterfall layers currently hold this content. */
  layers: readonly PermanenceLayer[];
  /** Pixel width of the strip. Height is fixed at 4px. */
  width?: number;
  className?: string;
  'aria-label'?: string;
}

const COLORS: Record<PermanenceLayer, string> = {
  mesh: '#A8C3B5', // sage
  providers: '#3F6B5C', // verdigris
  edge: 'rgba(243, 238, 228, 0.4)', // bone 40%
  cold: '#E8B86D', // creamy gold
};

const DIM: Record<PermanenceLayer, string> = {
  mesh: 'rgba(168, 195, 181, 0.15)',
  providers: 'rgba(63, 107, 92, 0.15)',
  edge: 'rgba(243, 238, 228, 0.08)',
  cold: 'rgba(232, 184, 109, 0.15)',
};

const ORDER: readonly PermanenceLayer[] = ['mesh', 'providers', 'edge', 'cold'];

/**
 * PermanenceStrip — 4-segment pill showing Waterfall layer presence.
 * Active layer = full color. Inactive layer = dim variant (still visible, signals future).
 *
 * See docs/protocol-spec/9-resilience.md for the L1→L4 Waterfall.
 */
export function PermanenceStrip({
  layers,
  width = 120,
  className,
  'aria-label': ariaLabel,
}: PermanenceStripProps) {
  const active = new Set(layers);
  return (
    <div
      role="img"
      aria-label={ariaLabel ?? `persistência: ${[...active].join(', ')}`}
      className={cn('aevia-permanence-strip', className)}
      style={{ width, height: 4 }}
    >
      {ORDER.map((layer) => (
        <span
          key={layer}
          style={{
            backgroundColor: active.has(layer) ? COLORS[layer] : DIM[layer],
          }}
        />
      ))}
    </div>
  );
}
