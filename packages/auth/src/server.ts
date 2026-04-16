import { PrivyClient, type User } from '@privy-io/node';
import { cookies } from 'next/headers';
import { AEVIA_CHAIN_ID_MAINNET } from './chains';
import { addressToDid, shortAddress } from './did';
import type { AeviaSession, LoginMethod } from './types';

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
 * Resolution order chosen for determinism (so every request that sees the
 * same cookies returns the same answer — critical to avoid redirect loops
 * between `/` and `/dashboard`):
 *
 * 1. Access-token path (preferred) — verify via `utils().auth().verifyAuthToken`,
 *    then load the full user via `users()._get(userId)`. This always yields
 *    a complete `linked_accounts` array.
 * 2. Identity-token path (fallback) — `users().get({id_token})`. The identity
 *    token can be size-limited and occasionally ships a partial user with no
 *    wallet entries; using it only as fallback prevents returning null when a
 *    valid session exists.
 *
 * If either path succeeds but the user object has no Ethereum wallet, we
 * continue to the next path instead of returning null early. Returns null
 * only when every reachable path fails.
 */
export async function readAeviaSession(): Promise<AeviaSession | null> {
  let privy: PrivyClient;
  try {
    privy = getPrivyClient();
  } catch {
    return null;
  }

  const store = await cookies();
  const accessToken = readCookieValue(ACCESS_COOKIE_NAMES, store);
  const idToken = readCookieValue(IDENTITY_COOKIE_NAMES, store);

  if (accessToken) {
    try {
      const verified = await privy.utils().auth().verifyAuthToken(accessToken);
      const userId =
        (verified as { user_id?: string; userId?: string }).user_id ??
        (verified as { userId?: string }).userId;
      if (userId) {
        const user = await privy.users()._get(userId);
        const expiresAt = Number((verified as { expiration?: number | string }).expiration ?? 0);
        const session = userToSession(user, expiresAt);
        if (session) return session;
        console.error('[aevia-auth] access-token path: user has no ethereum wallet', {
          userId,
        });
      }
    } catch (err) {
      console.error('[aevia-auth] access-token path failed:', err);
    }
  }

  if (idToken) {
    try {
      const user = await privy.users().get({ id_token: idToken });
      const session = userToSession(user);
      if (session) return session;
      console.error('[aevia-auth] id-token path: user has no ethereum wallet');
    } catch (err) {
      console.error('[aevia-auth] id-token path failed:', err);
    }
  }

  if (!accessToken && !idToken) {
    console.error('[aevia-auth] no privy cookies present on protected request');
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

  const out: SessionDiag = {
    cookieNames,
    hasAccessToken: Boolean(accessToken),
    hasIdToken: Boolean(idToken),
    appIdPresent: Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID),
    appSecretPresent: Boolean(process.env.PRIVY_APP_SECRET),
  };

  let privy: PrivyClient;
  try {
    privy = getPrivyClient();
  } catch (err) {
    return { ...out, stage: 'client-init', error: describeError(err) };
  }

  if (accessToken) {
    try {
      const verified = (await privy.utils().auth().verifyAuthToken(accessToken)) as SessionDiag;
      const userId = (verified.user_id ?? verified.userId) as string | undefined;
      out.verifyAuthToken = { ok: true, userId, expiration: verified.expiration };
      if (userId) {
        try {
          const user = (await privy.users()._get(userId)) as unknown as User;
          out.usersGet = {
            ok: true,
            id: user.id,
            linkedAccountCount: user.linked_accounts?.length ?? 0,
            linkedAccountTypes: (user.linked_accounts ?? []).map((a) => a.type),
            hasEthereumAddress: Boolean(pickEthereumAddress(user)),
          };
        } catch (err) {
          out.usersGet = { ok: false, error: describeError(err) };
        }
      }
    } catch (err) {
      out.verifyAuthToken = { ok: false, error: describeError(err) };
    }
  }

  if (idToken) {
    try {
      const user = (await privy.users().get({ id_token: idToken })) as unknown as User;
      out.usersGetByIdToken = {
        ok: true,
        id: user.id,
        linkedAccountCount: user.linked_accounts?.length ?? 0,
        hasEthereumAddress: Boolean(pickEthereumAddress(user)),
      };
    } catch (err) {
      out.usersGetByIdToken = { ok: false, error: describeError(err) };
    }
  }

  return out;
}

/**
 * Verify a raw token from `Authorization: Bearer <jwt>` headers.
 * Accepts either an identity token or an access token.
 */
export async function verifyBearerToken(token: string): Promise<AeviaSession | null> {
  let privy: PrivyClient;
  try {
    privy = getPrivyClient();
  } catch {
    return null;
  }

  try {
    const verified = await privy.utils().auth().verifyAuthToken(token);
    const userId =
      (verified as { user_id?: string; userId?: string }).user_id ??
      (verified as { userId?: string }).userId;
    if (userId) {
      const user = await privy.users()._get(userId);
      const expiresAt = Number((verified as { expiration?: number | string }).expiration ?? 0);
      const session = userToSession(user, expiresAt);
      if (session) return session;
    }
  } catch (err) {
    console.error('[aevia-auth] bearer access-token path failed:', err);
  }

  try {
    const user = await privy.users().get({ id_token: token });
    const session = userToSession(user);
    if (session) return session;
  } catch (err) {
    console.error('[aevia-auth] bearer id-token path failed:', err);
  }

  return null;
}
