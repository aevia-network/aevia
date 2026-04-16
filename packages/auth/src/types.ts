/**
 * did:pkh identifier on Base mainnet (chainId 8453).
 * Example: did:pkh:eip155:8453:0xAbc123...
 */
export type AeviaDid = `did:pkh:eip155:8453:0x${string}`;

/**
 * Aevia session payload — issued by Privy, re-encoded for app use.
 */
export interface AeviaSession {
  did: AeviaDid;
  address: `0x${string}`;
  loginMethod: 'email' | 'google' | 'apple' | 'passkey' | 'wallet';
  issuedAt: number;
  expiresAt: number;
}
