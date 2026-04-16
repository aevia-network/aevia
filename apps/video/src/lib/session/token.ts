import { SignJWT, jwtVerify } from 'jose';
import { getServerEnv } from '../env';
import type { AeviaAnonSession } from './types';

function getKey(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().SESSION_SIGNING_KEY);
}

export async function signSession(
  payload: Pick<AeviaAnonSession, 'sub' | 'handle' | 'type' | 'v'>,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .setIssuer('aevia.video')
    .setAudience('aevia.video')
    .sign(getKey());
}

export async function verifySession(token: string): Promise<AeviaAnonSession | null> {
  try {
    const { payload } = await jwtVerify(token, getKey(), {
      issuer: 'aevia.video',
      audience: 'aevia.video',
    });
    return payload as unknown as AeviaAnonSession;
  } catch {
    return null;
  }
}
