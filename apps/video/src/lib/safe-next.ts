/**
 * Validate a `?next=...` query parameter for a safe in-app redirect after
 * sign-in (or any post-auth handoff).
 *
 * The naive check `next.startsWith('/')` is **not** sufficient: browsers
 * resolve `//evil.com/path` as a protocol-relative URL pointing off-site,
 * yet `'/'` is its first character. A backslash variant `'/\\evil.com'` is
 * normalised by some browsers into a host-relative redirect too. Both are
 * classic open-redirect vectors used in phishing chains where the attacker
 * tricks a victim into clicking a link to the legitimate sign-in page,
 * the user authenticates, and the redirect ends up on the attacker's host.
 *
 * Accept rules — every condition must hold:
 *   1. `next` is a string.
 *   2. Begins with a single `/`.
 *   3. The character after that `/` is neither `/` nor `\` (rejects
 *      protocol-relative + backslash-host tricks).
 *
 * Anything else falls back to the caller-supplied default.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (typeof next !== 'string') return fallback;
  if (next.length === 0) return fallback;
  if (next[0] !== '/') return fallback;
  // Reject `//evil.com/...` and `/\evil.com/...`.
  if (next[1] === '/' || next[1] === '\\') return fallback;
  return next;
}
