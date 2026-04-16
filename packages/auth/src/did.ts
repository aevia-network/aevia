import type { AeviaDid } from './types';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const DID_RE = /^did:pkh:eip155:(\d+):(0x[a-fA-F0-9]{40})$/;

/**
 * Derive a `did:pkh` identifier from an Ethereum address per CAIP-10.
 * Always returns the address in lowercase; callers should not compare case-sensitively.
 */
export function addressToDid(address: string, chainId = 8453): AeviaDid {
  if (!ADDRESS_RE.test(address)) {
    throw new Error(`invalid ethereum address: ${address}`);
  }
  return `did:pkh:eip155:${chainId}:${address.toLowerCase()}` as AeviaDid;
}

export function didToAddress(did: string): `0x${string}` | null {
  const match = did.match(DID_RE);
  if (!match) return null;
  return match[2]?.toLowerCase() as `0x${string}`;
}

export function didChainId(did: string): number | null {
  const match = did.match(DID_RE);
  if (!match) return null;
  return Number(match[1]);
}

/** Compact display: "0xabcd…9f4" */
export function shortAddress(address: string, head = 6, tail = 4): string {
  if (!ADDRESS_RE.test(address)) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
