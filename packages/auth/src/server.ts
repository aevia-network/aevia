import { cookies } from 'next/headers';
import { appChainId } from './chains';
import { addressToDid, shortAddress } from './did';
import type { AeviaSession, LoginMethod } from './types';
import {
  type PrivyIdentityTokenPayload,
  type PrivyLinkedAccountLite,
  parseLinkedAccounts,
  verifyPrivyJwt,
} from './verify-edge';

/**
 * Minimal `User` shape — only the fields this module actually uses. We
 * intentionally do not import `@privy-io/node`'s `User` type: the SDK's
 * transitive dep graph (viem → `@base-org/account`) ships browser
 * telemetry that references `XMLHttpRequest` at module scope, which
 * breaks Cloudflare's edge runtime at request time.
 */
interface User {
  id: string;
  linked_accounts?: PrivyLinkedAccountLite[];
  created_at?: number;
}

const IDENTITY_COOKIE_NAMES = ['privy-id-token', '__Host-privy-id-token'] as const;
const ACCESS_COOKIE_NAMES = ['privy-token', '__Host-privy-token'] as const;
const PRIVY_API_BASE = 'https://auth.privy.io/api/v1';

/**
 * Fetch a Privy user by id via the REST API, bypassing `@privy-io/node`.
 * Used only on the access-token fallback (identity-token path resolves
 * the user from the JWT payload without any network call).
 */
async function fetchPrivyUser(userId: string): Promise<User> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Privy not configured');
  const res = await fetch(`${PRIVY_API_BASE}/users/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      'privy-app-id': appId,
      authorization: `Basic ${btoa(`${appId}:${appSecret}`)}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Privy users GET failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as User;
}

function pickEthereumAddress(user: User): string | null {
  for (const account of user.linked_accounts ?? []) {
    if (account.type === 'wallet' || account.type === 'smart_wallet') {
      const chain = (account as { chain_type?: string }).chain_type;
      if (chain === 'ethereum' || chain === undefined) {
        const addr = (account as { address?: string }).address;
        if (addr) return addr.toLowerCase();
      }
    }
  }
  return null;
}

function detectLoginMethod(user: User): LoginMethod {
  const types = new Set((user.linked_accounts ?? []).map((a) => a.type));
  if (types.has('email')) return 'email';
  if (types.has('google_oauth')) return 'google';
  if (types.has('apple_oauth')) return 'apple';
  if (types.has('passkey')) return 'passkey';
  if (types.has('wallet') || types.has('smart_wallet')) return 'wallet';
  return 'unknown';
}

function pickDisplayName(user: User, address: string): string {
  for (const account of user.linked_accounts ?? []) {
    if (account.type === 'email') {
      const addr = (account as { address?: string }).address;
      if (addr) return addr;
    }
    if (account.type === 'google_oauth') {
      const name = (account as { name?: string }).name;
      const email = (account as { email?: string }).email;
      if (name) return name;
      if (email) return email;
    }
    if (account.type === 'apple_oauth') {
      const email = (account as { email?: string }).email;
      if (email) return email;
    }
  }
  return shortAddress(address);
}

function userToSession(user: User, expiresAt = 0): AeviaSession | null {
  const address = pickEthereumAddress(user);
  if (!address) return null;
  return {
    userId: user.id,
    address: address as `0x${string}`,
    did: addressToDid(address, appChainId()),
    displayName: pickDisplayName(user, address),
    loginMethod: detectLoginMethod(user),
    expiresAt,
  };
}

function readCookieValue(names: readonly string[], store: Awaited<ReturnType<typeof cookies>>) {
  for (const name of names) {
    const value = store.get(name)?.value;
    if (value) return value;
  }
  return undefined;
}

/**
 * Read and verify the current user's Privy session from cookies.
 *
 * Resolution order:
 *
 * 1. **Identity-token path (preferred)** — `users().get({id_token})`. The
 *    identity token lives for days / weeks (not 1 h like the access token)
 *    and Privy validates it server-side in the API call, so we bypass the
 *    local `jose` + JWKS path that intermittently fails on Cloudflare's
 *    edge runtime with "Failed to verify authentication token".
 * 2. **Access-token path (fallback)** — verify via
 *    `utils().auth().verifyAuthToken` and fetch the user by id. Only used
 *    when the id-token is absent (e.g. Privy app has not enabled identity
 *    tokens yet).
 *
 * If either path succeeds but the user has no Ethereum wallet, we continue
 * to the next path. Returns null only when every reachable path fails.
 */
/**
 * Build a `User`-shaped object from an identity-token payload's inline
 * `linked_accounts`. The identity token carries enough metadata to resolve
 * a session without any API call — avoids the `users()._get` round-trip
 * that would otherwise be needed on the access-token path.
 */
function userFromIdentityTokenPayload(
  payload: PrivyIdentityTokenPayload,
  linkedAccounts: PrivyLinkedAccountLite[],
): User | null {
  if (!linkedAccounts.length) return null;
  return {
    id: payload.sub,
    created_at: payload.cr ? Number(payload.cr) : 0,
    linked_accounts: linkedAccounts,
    // Surface only what downstream helpers consume; remaining fields are
    // unused by `userToSession` and safely coerced.
  } as unknown as User;
}

/**
 * Fixed dev session used when AEVIA_DEV_BYPASS_AUTH=true. The address
 * is a burn-after-reading test account; do not send funds. The DID is
 * derived from it via the usual chain-scoped PKH rule, so downstream
 * logic (WHIP X-Aevia-DID header, creator attribution in the provider
 * node logs, signed manifests once Protocol Spec §3 lands) behaves
 * identically to a real Privy session.
 */
const DEV_BYPASS_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;

function devBypassSession(): AeviaSession {
  return {
    userId: 'dev-bypass',
    address: DEV_BYPASS_ADDRESS,
    did: addressToDid(DEV_BYPASS_ADDRESS, appChainId()),
    displayName: 'dev',
    loginMethod: 'unknown',
    expiresAt: 0,
  };
}

export async function readAeviaSession(): Promise<AeviaSession | null> {
  // Dev-only short-circuit. Both the server-side flag and the public one
  // are checked so that server components running on the edge still see
  // the bypass (the public var survives the build; the server var
  // matches client-side providers.tsx behavior).
  if (
    process.env.AEVIA_DEV_BYPASS_AUTH === 'true' ||
    process.env.NEXT_PUBLIC_AEVIA_DEV_BYPASS_AUTH === 'true'
  ) {
    return devBypassSession();
  }

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return null;

  const store = await cookies();
  const idToken = readCookieValue(IDENTITY_COOKIE_NAMES, store);
  const accessToken = readCookieValue(ACCESS_COOKIE_NAMES, store);

  // Identity-token path (preferred) — token carries the full linked-account
  // list inline, so one local signature verification resolves the session
  // with zero network calls.
  if (idToken) {
    try {
      const payload = await verifyPrivyJwt<PrivyIdentityTokenPayload>(idToken, appId);
      const accounts = parseLinkedAccounts(payload);
      const user = userFromIdentityTokenPayload(payload, accounts);
      if (user) {
        const session = userToSession(user, payload.exp ?? 0);
        if (session) return session;
        console.error('[aevia-auth] id-token path: user has no ethereum wallet');
      } else {
        console.error('[aevia-auth] id-token path: linked_accounts missing or empty');
      }
    } catch (err) {
      console.error('[aevia-auth] id-token verification failed:', err);
    }
  }

  // Access-token path (fallback) — access tokens do not carry
  // `linked_accounts` in their payload, so after local verification we
  // fetch the user via Privy's REST API directly (no SDK).
  if (accessToken) {
    try {
      const payload = await verifyPrivyJwt(accessToken, appId);
      if (payload.sub) {
        const user = await fetchPrivyUser(payload.sub);
        const session = userToSession(user, payload.exp ?? 0);
        if (session) return session;
        console.error('[aevia-auth] access-token path: user has no ethereum wallet', {
          userId: payload.sub,
        });
      }
    } catch (err) {
      console.error('[aevia-auth] access-token verification failed:', err);
    }
  }

  if (!accessToken && !idToken) {
    console.error('[aevia-auth] no usable privy cookies on protected request');
  }

  return null;
}

/**
 * Verify a raw token from `Authorization: Bearer <jwt>` headers. Uses the
 * same local JWKS verification as `readAeviaSession` for edge safety —
 * accepts either an identity token (payload carries `linked_accounts`) or
 * an access token (payload only carries `sub`, falls back to a Privy API
 * lookup for the full user).
 */
export async function verifyBearerToken(token: string): Promise<AeviaSession | null> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return null;

  try {
    const payload = await verifyPrivyJwt<PrivyIdentityTokenPayload>(token, appId);
    const accounts = parseLinkedAccounts(payload);
    if (accounts.length) {
      const user = userFromIdentityTokenPayload(payload, accounts);
      if (user) {
        const session = userToSession(user, payload.exp ?? 0);
        if (session) return session;
      }
    }
    if (payload.sub) {
      const user = await fetchPrivyUser(payload.sub);
      const session = userToSession(user, payload.exp ?? 0);
      if (session) return session;
    }
  } catch (err) {
    console.error('[aevia-auth] bearer verification failed:', err);
  }

  return null;
}
