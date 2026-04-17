import { PrivyClient, type User } from '@privy-io/node';
import { cookies } from 'next/headers';
import { AEVIA_CHAIN_ID_MAINNET } from './chains';
import { addressToDid, shortAddress } from './did';
import type { AeviaSession, LoginMethod } from './types';
import {
  type PrivyIdentityTokenPayload,
  type PrivyLinkedAccountLite,
  parseLinkedAccounts,
  verifyPrivyJwt,
} from './verify-edge';

let _client: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (_client) return _client;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      'Privy not configured: set NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET (see SETUP.md).',
    );
  }
  _client = new PrivyClient({ appId, appSecret });
  return _client;
}

const IDENTITY_COOKIE_NAMES = ['privy-id-token', '__Host-privy-id-token'] as const;
const ACCESS_COOKIE_NAMES = ['privy-token', '__Host-privy-token'] as const;

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
    did: addressToDid(address, AEVIA_CHAIN_ID_MAINNET),
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

export async function readAeviaSession(): Promise<AeviaSession | null> {
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
  // still have to fetch the user via the Privy API.
  if (accessToken) {
    try {
      const payload = await verifyPrivyJwt(accessToken, appId);
      if (payload.sub) {
        let privy: PrivyClient;
        try {
          privy = getPrivyClient();
        } catch {
          return null;
        }
        const user = await privy.users()._get(payload.sub);
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

type SessionDiag = Record<string, unknown>;

function describeError(err: unknown): SessionDiag {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 6).join('\n'),
    };
  }
  return { value: String(err) };
}

/**
 * Diagnostic — returns full ground truth on every step of session resolution.
 * Intended for a debug endpoint; never wire into the happy path.
 */
export async function diagnoseSession(): Promise<SessionDiag> {
  const store = await cookies();
  const cookieNames = store.getAll().map((c) => c.name);
  const accessToken = readCookieValue(ACCESS_COOKIE_NAMES, store);
  const idToken = readCookieValue(IDENTITY_COOKIE_NAMES, store);
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  const out: SessionDiag = {
    cookieNames,
    hasAccessToken: Boolean(accessToken),
    hasIdToken: Boolean(idToken),
    appIdPresent: Boolean(appId),
    appSecretPresent: Boolean(process.env.PRIVY_APP_SECRET),
    hasRefreshToken: Boolean(
      store.get('privy-session')?.value ?? store.get('__Host-privy-session')?.value,
    ),
  };

  if (!appId) return out;

  if (idToken) {
    try {
      const payload = await verifyPrivyJwt<PrivyIdentityTokenPayload>(idToken, appId);
      const accounts = parseLinkedAccounts(payload);
      out.verifyIdToken = {
        ok: true,
        userId: payload.sub,
        exp: payload.exp,
        linkedAccountCount: accounts.length,
        linkedAccountTypes: accounts.map((a) => a.type),
        hasEthereumAddress: accounts.some(
          (a) => a.type === 'wallet' && a.chain_type === 'ethereum' && a.address,
        ),
      };
    } catch (err) {
      out.verifyIdToken = { ok: false, error: describeError(err) };
    }
  }

  if (accessToken) {
    try {
      const payload = await verifyPrivyJwt(accessToken, appId);
      out.verifyAccessToken = { ok: true, userId: payload.sub, exp: payload.exp };
    } catch (err) {
      out.verifyAccessToken = { ok: false, error: describeError(err) };
    }
  }

  return out;
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
      const privy = getPrivyClient();
      const user = await privy.users()._get(payload.sub);
      const session = userToSession(user, payload.exp ?? 0);
      if (session) return session;
    }
  } catch (err) {
    console.error('[aevia-auth] bearer verification failed:', err);
  }

  return null;
}
