export interface AeviaAnonSession {
  /** ULID-like identifier for the anonymous session. */
  sub: string;
  /** Human-readable handle, e.g. "SparrowFalcon-7a2b". */
  handle: string;
  /** Session type — anon now, user after Privy promotion (Sprint 2+). */
  type: 'anon' | 'user';
  /** Schema version for forward compatibility. */
  v: 1;
  /** Issued at (epoch seconds). */
  iat?: number;
  /** Expiration (epoch seconds). */
  exp?: number;
}
