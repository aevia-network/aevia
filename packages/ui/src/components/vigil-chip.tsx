import type * as React from 'react';
import { cn } from '../lib/cn';

/**
 * VigilChip — signature component displayed beside a creator's name.
 *
 * Signals "vigília" (vigil): the creator is currently broadcasting or their
 * most recent broadcast is being preserved in the Aevia mesh. Keep the chip
 * lowercase; the word itself is the label.
 */
export function VigilChip({
  label = 'vigília',
  className,
  ...props
}: {
  label?: string;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium tracking-wide text-primary',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-primary" />
      {label}
    </span>
  );
}
