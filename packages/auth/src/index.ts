/**
 * @aevia/auth — shared auth primitives for Aevia clients and servers.
 *
 * - Main entry (`@aevia/auth`): DID helpers, types, chain constants (safe on edge + client).
 * - `@aevia/auth/client`: React SDK wrapper (`'use client'`).
 * - `@aevia/auth/server`: server-side session + token verification (`next/headers` + Privy server SDK).
 */

export { addressToDid, didToAddress, didChainId, shortAddress } from './did';
export {
  AEVIA_CHAIN_ID_MAINNET,
  AEVIA_CHAIN_ID_SEPOLIA,
  base,
  baseSepolia,
  defaultChain,
} from './chains';
export type { AeviaDid, AeviaSession, LoginMethod } from './types';
