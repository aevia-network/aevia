import { cn } from '../lib/cn';

/**
 * MeshDot — signature 6px sage pulse.
 * Indicates active P2P mesh presence. Used beside the wordmark in the header
 * and inline wherever we show peer counts.
 */
export function MeshDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('aevia-mesh-dot', className)} />;
}
