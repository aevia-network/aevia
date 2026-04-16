import { cookies } from 'next/headers';
import { generateHandle, generateSessionId } from './handle';
import { signSession, verifySession } from './token';
import type { AeviaAnonSession } from './types';

const COOKIE_NAME = 'aevia_sid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function readSession(): Promise<AeviaAnonSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function createAnonSession(): Promise<AeviaAnonSession> {
  const session: Omit<AeviaAnonSession, 'iat' | 'exp'> = {
    sub: generateSessionId(),
    handle: generateHandle(),
    type: 'anon',
    v: 1,
  };
  const token = await signSession(session);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return session as AeviaAnonSession;
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
