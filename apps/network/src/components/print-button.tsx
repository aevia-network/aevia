'use client';

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      data-print-hide="true"
      onClick={() => {
        if (typeof window !== 'undefined') window.print();
      }}
      className="font-label text-sm text-primary transition-colors hover:text-primary-dim"
    >
      {label}
    </button>
  );
}
