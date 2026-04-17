import { describe, expect, it } from 'vitest';
import { AEVIA_CHAIN_ID_MAINNET, AEVIA_CHAIN_ID_SEPOLIA } from '../chains';
import { addressToDid, didChainId, didToAddress, shortAddress } from '../did';

const MIXED_CASE_ADDRESS = '0xABcDef0123456789abcdef0123456789ABCdef01';
const LOWERCASE_ADDRESS = MIXED_CASE_ADDRESS.toLowerCase();

describe('addressToDid', () => {
  it('produces a did:pkh with the default Base mainnet chain id and a lowercased address', () => {
    const did = addressToDid(MIXED_CASE_ADDRESS);
    expect(did).toBe(`did:pkh:eip155:${AEVIA_CHAIN_ID_MAINNET}:${LOWERCASE_ADDRESS}`);
  });

  it('honours a custom chain id', () => {
    const did = addressToDid(MIXED_CASE_ADDRESS, AEVIA_CHAIN_ID_SEPOLIA);
    expect(did).toBe(`did:pkh:eip155:${AEVIA_CHAIN_ID_SEPOLIA}:${LOWERCASE_ADDRESS}`);
  });

  it('throws on a malformed address', () => {
    expect(() => addressToDid('not-an-address')).toThrow(/invalid ethereum address/);
    expect(() => addressToDid('0x1234')).toThrow(/invalid ethereum address/);
    expect(() => addressToDid(`${MIXED_CASE_ADDRESS}extra`)).toThrow(/invalid ethereum address/);
  });
});

describe('didToAddress', () => {
  it('round-trips the output of addressToDid', () => {
    const did = addressToDid(MIXED_CASE_ADDRESS, AEVIA_CHAIN_ID_SEPOLIA);
    expect(didToAddress(did)).toBe(LOWERCASE_ADDRESS);
  });

  it('returns null on a malformed DID', () => {
    expect(didToAddress('did:web:example.com')).toBeNull();
    expect(didToAddress('did:pkh:eip155:8453:not-an-address')).toBeNull();
    expect(didToAddress('did:pkh:solana:123:xyz')).toBeNull();
    expect(didToAddress('')).toBeNull();
  });
});

describe('didChainId', () => {
  it('extracts the numeric chain id', () => {
    expect(didChainId(addressToDid(MIXED_CASE_ADDRESS, 8453))).toBe(8453);
    expect(didChainId(addressToDid(MIXED_CASE_ADDRESS, 84532))).toBe(84532);
  });

  it('returns null on a malformed DID', () => {
    expect(didChainId('did:web:example.com')).toBeNull();
    expect(didChainId('did:pkh:eip155:abc:0x0000000000000000000000000000000000000000')).toBeNull();
  });
});

describe('shortAddress', () => {
  it('defaults to a 6-character head and 4-character tail', () => {
    const short = shortAddress(LOWERCASE_ADDRESS);
    expect(short).toBe(`${LOWERCASE_ADDRESS.slice(0, 6)}…${LOWERCASE_ADDRESS.slice(-4)}`);
  });

  it('respects custom head and tail spans', () => {
    const short = shortAddress(LOWERCASE_ADDRESS, 4, 6);
    expect(short).toBe(`${LOWERCASE_ADDRESS.slice(0, 4)}…${LOWERCASE_ADDRESS.slice(-6)}`);
  });

  it('returns the input unchanged when it is not a valid address', () => {
    expect(shortAddress('not-an-address')).toBe('not-an-address');
    expect(shortAddress('')).toBe('');
    expect(shortAddress('0xABC')).toBe('0xABC');
  });
});
