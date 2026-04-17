import { type JSONWebKeySet, createLocalJWKSet, jwtVerify } from 'jose';

/**
 * Privy signs JWTs with rotating ES256 keys served from
 * `https://auth.privy.io/api/v1/apps/{appId}/jwks.json`. The official SDK
 * (@privy-io/node@0.1) always fetches this JWKS at verification time via
 * `createRemoteJWKSet`. On Cloudflare's edge runtime that fetch flakes on
 * cold starts and the verification throws "Failed to verify authentication
 * token" — catch-all that masks the underlying JWKS fetch failure.
 *
 * We embed the current public JWKS here and build a local key set at module
 * init. Zero runtime fetches, 100% local WebCrypto verification, consistent
 * across every edge instance.
 *
 * If Privy rotates keys, this array needs to be updated and the app
 * redeployed. Fetch the current JWKS to refresh:
 *
 *   curl https://auth.privy.io/api/v1/apps/<appId>/jwks.json
 */
const PRIVY_JWKS: JSONWebKeySet = {
  keys: [
    {
      kty: 'EC',
      x: 'RVqOtnX6dFnea8MFHDy5AxRfh-daWop53PHMGdqYvlI',
      y: '4BlZothXNqxRw4KDB1jAsrdK7H0Hn6ZEHEDVbrm_2so',
      crv: 'P-256',
      kid: 'roivi8NpG9Tg6p5zdALRzKSwey73WDuY4gu5gJljDzQ',
      use: 'sig',
      alg: 'ES256',
    },
    {
      kty: 'EC',
      x: 's97Ih_Iwc3qoyYqAKD5H68xR3GR73F7nbYjpUZoAai4',
      y: 'tscPItVt6cumoyQGaFDlE164K7Mxj5AYpAWCXWDrCKs',
      crv: 'P-256',
      kid: 'QhFR9cZjl2YD78KmBPXf7Z-Z-rbmgo85adrDVsM68kU',
      use: 'sig',
      alg: 'ES256',
    },
  ],
};

const getKey = createLocalJWKSet(PRIVY_JWKS);

export interface PrivyAccessTokenPayload {
  sub: string;
  sid?: string;
  iss: string;
  iat: number;
  exp: number;
  aud: string | string[];
}

export interface PrivyLinkedAccountLite {
  type: string;
  address?: string;
  chain_type?: string;
  email?: string;
  name?: string;
}

export interface PrivyIdentityTokenPayload extends PrivyAccessTokenPayload {
  /** Stringified JSON array; see `parseLinkedAccounts`. */
  linked_accounts?: string;
  cr?: string;
}

/**
 * Verify a Privy-issued JWT (access or identity token) against the embedded
 * JWKS. Returns the decoded payload on success, throws on invalid signature
 * or expired token.
 */
export async function verifyPrivyJwt<T extends PrivyAccessTokenPayload = PrivyAccessTokenPayload>(
  token: string,
  appId: string,
): Promise<T> {
  const { payload } = await jwtVerify(token, getKey, {
    issuer: 'privy.io',
    audience: appId,
  });
  return payload as unknown as T;
}

/**
 * Identity tokens ship `linked_accounts` as a stringified JSON array
 * (Privy's wire format). Parse defensively — if the field is missing or
 * malformed, return `[]` so the caller can fall through.
 */
export function parseLinkedAccounts(payload: PrivyIdentityTokenPayload): PrivyLinkedAccountLite[] {
  if (!payload.linked_accounts) return [];
  try {
    const parsed = JSON.parse(payload.linked_accounts);
    return Array.isArray(parsed) ? (parsed as PrivyLinkedAccountLite[]) : [];
  } catch {
    return [];
  }
}
