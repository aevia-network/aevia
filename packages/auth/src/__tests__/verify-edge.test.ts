import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { describe, expect, it } from 'vitest';
import { parseLinkedAccounts, verifyPrivyJwt } from '../verify-edge';

const APP_ID = 'test-app-id';

/**
 * Sign an ES256 JWT with a fresh P-256 key pair NOT in the embedded JWKS.
 * Every call to `verifyPrivyJwt` with one of these tokens MUST be rejected,
 * because the local JWKS (`verify-edge.ts`) resolves keys by `kid` — a random
 * kid will not match any embedded entry.
 */
async function mintForeignJwt(
  options: {
    issuer?: string;
    audience?: string | string[];
    iat?: number;
    exp?: number;
    payload?: Record<string, unknown>;
    kid?: string;
  } = {},
) {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  const kid = options.kid ?? 'foreign-key-id';

  const now = Math.floor(Date.now() / 1000);
  const iat = options.iat ?? now;
  const exp = options.exp ?? now + 3600;

  const token = await new SignJWT({ ...(options.payload ?? {}) })
    .setProtectedHeader({ alg: 'ES256', kid })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .setIssuer(options.issuer ?? 'privy.io')
    .setAudience(options.audience ?? APP_ID)
    .setSubject('did:privy:test-subject')
    .sign(privateKey);

  return { token, publicJwk: jwk };
}

describe('verifyPrivyJwt', () => {
  it('throws on a malformed token', async () => {
    await expect(verifyPrivyJwt('not-a-jwt', APP_ID)).rejects.toThrow();
    await expect(verifyPrivyJwt('', APP_ID)).rejects.toThrow();
    await expect(verifyPrivyJwt('a.b.c', APP_ID)).rejects.toThrow();
  });

  it('throws on a valid ES256 JWT signed by a key NOT in the embedded JWKS', async () => {
    const { token } = await mintForeignJwt();
    await expect(verifyPrivyJwt(token, APP_ID)).rejects.toThrow();
  });

  // TODO (Sprint 3 — JWKS rotation test plan): exercise the happy-path branch
  // of `verifyPrivyJwt` with a token signed by one of the two embedded keys.
  // Doing so requires the corresponding Privy private keys, which we do not
  // possess by design. Sprint 3 will introduce a fixture that either (a)
  // temporarily swaps the embedded JWKS for a test-controlled key set or (b)
  // derives a dev-mode token via Privy's test API. Tracking the happy-path
  // coverage gap here rather than hand-mocking the JWKS at module scope keeps
  // the production code untouched.
  it.skip('accepts a token signed with one of the embedded JWKS keys (deferred to Sprint 3 fixture)', () => {
    // Intentionally empty: see TODO above.
  });

  it('throws on an expired token (iat/exp in the past)', async () => {
    const hourAgo = Math.floor(Date.now() / 1000) - 3600;
    const { token } = await mintForeignJwt({ iat: hourAgo - 60, exp: hourAgo });
    await expect(verifyPrivyJwt(token, APP_ID)).rejects.toThrow();
  });

  it('throws on a wrong audience', async () => {
    const { token } = await mintForeignJwt({ audience: 'different-app-id' });
    await expect(verifyPrivyJwt(token, APP_ID)).rejects.toThrow();
  });

  it('throws on a wrong issuer', async () => {
    const { token } = await mintForeignJwt({ issuer: 'evil.example.com' });
    await expect(verifyPrivyJwt(token, APP_ID)).rejects.toThrow();
  });
});

describe('parseLinkedAccounts', () => {
  it('returns [] when linked_accounts is missing', () => {
    expect(
      parseLinkedAccounts({
        sub: 'x',
        iss: 'privy.io',
        aud: APP_ID,
        iat: 0,
        exp: 0,
      }),
    ).toEqual([]);
  });

  it('returns [] when linked_accounts is malformed JSON', () => {
    expect(
      parseLinkedAccounts({
        sub: 'x',
        iss: 'privy.io',
        aud: APP_ID,
        iat: 0,
        exp: 0,
        linked_accounts: '{not-json',
      }),
    ).toEqual([]);
  });

  it('returns [] when linked_accounts decodes to a non-array value', () => {
    expect(
      parseLinkedAccounts({
        sub: 'x',
        iss: 'privy.io',
        aud: APP_ID,
        iat: 0,
        exp: 0,
        linked_accounts: JSON.stringify({ type: 'wallet' }),
      }),
    ).toEqual([]);
  });

  it('parses a valid Privy-shape stringified JSON array', () => {
    const accounts = [
      { type: 'wallet', address: '0xabc', chain_type: 'ethereum' },
      { type: 'email', email: 'founder@example.com' },
    ];
    const parsed = parseLinkedAccounts({
      sub: 'x',
      iss: 'privy.io',
      aud: APP_ID,
      iat: 0,
      exp: 0,
      linked_accounts: JSON.stringify(accounts),
    });
    expect(parsed).toEqual(accounts);
  });
});
