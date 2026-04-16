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
  for (const account of user.linked_accounts) {
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
  const types = new Set(user.linked_accounts.map((a) => a.type));
  if (types.has('email')) return 'email';
  if (types.has('google_oauth')) return 'google';
  if (types.has('apple_oauth')) return 'apple';
  if (types.has('passkey')) return 'passkey';
  if (types.has('wallet') || types.has('smart_wallet')) return 'wallet';
  return 'unknown';
}

function pickDisplayName(user: User, address: string): string {
  for (const account of user.linked_accounts) {
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
 * Prefers the identity token (single-call verify + parse); falls back to the
 * access token path (verify, then `_get(userId)`). Returns null on any failure.
 */
export async function readAeviaSession(): Promise<AeviaSession | null> {
  let privy: PrivyClient;
  try {
    privy = getPrivyClient();
  } catch {
    return null;
  }

  const store = await cookies();
  const idToken = readCookieValue(IDENTITY_COOKIE_NAMES, store);

  if (idToken) {
    try {
      const user = await privy.users().get({ id_token: idToken });
      return userToSession(user);
    } catch {
      // Fall through to access-token path.
    }
  }

  const accessToken = readCookieValue(ACCESS_COOKIE_NAMES, store);
  if (!accessToken) return null;

  try {
    const verified = await privy.utils().auth().verifyAuthToken(accessToken);
    const userId =
      (verified as { user_id?: string; userId?: string }).user_id ??
      (verified as { userId?: string }).userId;
    if (!userId) return null;
    const user = await privy.users()._get(userId);
    const expiresAt = Number((verified as { expiration?: number | string }).expiration ?? 0);
    return userToSession(user, expiresAt);
  } catch {
    return null;
  }
}

/**
 * Verify a raw token from `Authorization: Bearer <jwt>` headers.
 * Accepts either identity tokens or access tokens.
 */
export async function verifyBearerToken(token: string): Promise<AeviaSession | null> {
  let privy: PrivyClient;
  try {
    privy = getPrivyClient();
  } catch {
    return null;
  }

  try {
    const user = await privy.users().get({ id_token: token });
    return userToSession(user);
  } catch {
    // fall through
  }

  try {
    const verified = await privy.utils().auth().verifyAuthToken(token);
    const userId =
      (verified as { user_id?: string; userId?: string }).user_id ??
      (verified as { userId?: string }).userId;
    if (!userId) return null;
    const user = await privy.users()._get(userId);
    const expiresAt = Number((verified as { expiration?: number | string }).expiration ?? 0);
    return userToSession(user, expiresAt);
  } catch {
    return null;
  }
}
