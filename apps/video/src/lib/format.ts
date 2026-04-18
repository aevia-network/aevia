const PT_BR_TZ = 'America/Sao_Paulo';

const dateTimePtBR = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: PT_BR_TZ,
});

/**
 * Format an ISO timestamp as `dd/MM/yyyy HH:mm` in São Paulo time.
 *
 * Pinning the timezone is what keeps SSR and CSR output identical: server
 * runtimes (Cloudflare edge) default to UTC while the user's browser uses
 * their local TZ, so any `toLocaleString()` without `timeZone` triggers React
 * hydration warnings on every list row that renders a date.
 *
 * Choice of `America/Sao_Paulo` mirrors the project's pt-BR voice and gives
 * the platform a deterministic display TZ globally; users in Acre/Manaus see
 * São Paulo time, which is acceptable until per-user TZ preferences ship.
 */
export function formatDateTimePtBR(iso: string): string {
  return dateTimePtBR.format(new Date(iso));
}
