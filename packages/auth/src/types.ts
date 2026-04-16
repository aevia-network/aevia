/**
 * Aevia DID — `did:pkh` on Base L2 (chainId 8453 in production, 84532 on sepolia).
 * Format: `did:pkh:eip155:<chainId>:<lowercase-address>`.
 */
export type AeviaDid = `did:pkh:eip155:${number}:0x${string}`;

export type LoginMethod = 'email' | 'google' | 'apple' | 'passkey' | 'wallet' | 'unknown';

export interface AeviaSession {
  /** Privy internal user ID. Stable across logins. */
  userId: string;
  /** Ethereum address (lowercase, 0x-prefixed). */
  address: `0x${string}`;
  /** did:pkh identifier derived from the address. */
  did: AeviaDid;
  /** Best-available display name — email, Google/Apple name, or shortened address. */
  displayName: string;
  /** Primary login method used for this session. */
  loginMethod: LoginMethod;
  /** Token expiry as epoch seconds. 0 if unknown. */
  expiresAt: number;
}
