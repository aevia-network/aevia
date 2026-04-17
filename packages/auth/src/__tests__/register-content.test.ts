import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keccak256 } from 'viem';
import { describe, expect, it } from 'vitest';
import { AEVIA_CHAIN_ID_MAINNET, AEVIA_CHAIN_ID_SEPOLIA } from '../chains';
import {
  buildRegisterContentTypedData,
  contentRegistryAddress,
  sprint2PlaceholderManifestCid,
} from '../register-content';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEPLOYMENT_PATH = resolve(__dirname, '../../../contracts/deployments/base-sepolia.json');
const deployment = JSON.parse(readFileSync(DEPLOYMENT_PATH, 'utf8')) as {
  contracts: { ContentRegistry: { address: `0x${string}` } };
};
const SEPOLIA_REGISTRY = deployment.contracts.ContentRegistry.address;

const OWNER: `0x${string}` = '0xabcdef0123456789abcdef0123456789abcdef01';
const MANIFEST_CID: `0x${string}` =
  '0x1111111111111111111111111111111111111111111111111111111111111111';
const PARENT_CID: `0x${string}` =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

describe('contentRegistryAddress', () => {
  it('returns the deployed Sepolia address from the canonical deployment manifest', () => {
    expect(contentRegistryAddress(AEVIA_CHAIN_ID_SEPOLIA)).toBe(SEPOLIA_REGISTRY);
  });

  it('throws with a descriptive error on an unsupported chain id (mainnet pending audit)', () => {
    expect(() => contentRegistryAddress(AEVIA_CHAIN_ID_MAINNET)).toThrow(
      /ContentRegistry is not deployed on chainId=8453/,
    );
    expect(() => contentRegistryAddress(1)).toThrow(/Supported chains/);
  });
});

describe('buildRegisterContentTypedData', () => {
  const baseArgs = {
    owner: OWNER,
    manifestCid: MANIFEST_CID,
    parentCid: PARENT_CID,
    policyFlags: 0x01,
    chainId: AEVIA_CHAIN_ID_SEPOLIA,
    nonce: 0n,
    verifyingContract: SEPOLIA_REGISTRY,
  } as const;

  it('returns the expected EIP-712 domain, primary type, and type order', () => {
    const td = buildRegisterContentTypedData(baseArgs);

    expect(td.domain.name).toBe('Aevia ContentRegistry');
    expect(td.domain.version).toBe('1');
    expect(td.domain.chainId).toBe(AEVIA_CHAIN_ID_SEPOLIA);
    expect(td.domain.verifyingContract).toBe(SEPOLIA_REGISTRY);

    expect(td.primaryType).toBe('RegisterContent');

    // Field order must match REGISTER_TYPEHASH in ContentRegistry.sol.
    expect(td.types.RegisterContent.map((f) => f.name)).toEqual([
      'owner',
      'manifestCid',
      'parentCid',
      'policyFlags',
      'chainId',
      'nonce',
    ]);
    expect(td.types.RegisterContent.map((f) => f.type)).toEqual([
      'address',
      'bytes32',
      'bytes32',
      'uint8',
      'uint256',
      'uint256',
    ]);
  });

  it('emits message.chainId and message.nonce as plain numbers, not bigint or string', () => {
    // Regression guard: Privy's signing modal JSON.stringify's the preview and
    // breaks on bigint; MetaMask mis-hashes decimal-string uint256 values.
    const td = buildRegisterContentTypedData({ ...baseArgs, nonce: 42n });
    expect(typeof td.message.chainId).toBe('number');
    expect(typeof td.message.nonce).toBe('number');
    expect(td.message.chainId).toBe(AEVIA_CHAIN_ID_SEPOLIA);
    expect(td.message.nonce).toBe(42);
  });

  it('throws when policyFlags is below the uint8 range', () => {
    expect(() => buildRegisterContentTypedData({ ...baseArgs, policyFlags: -1 })).toThrow(
      /policyFlags out of uint8 range/,
    );
  });

  it('throws when policyFlags exceeds the uint8 range', () => {
    expect(() => buildRegisterContentTypedData({ ...baseArgs, policyFlags: 0x100 })).toThrow(
      /policyFlags out of uint8 range/,
    );
  });

  it('throws when policyFlags sets the reserved bit (0x80)', () => {
    expect(() => buildRegisterContentTypedData({ ...baseArgs, policyFlags: 0x80 })).toThrow(
      /reserved for moderator use/,
    );
    expect(() => buildRegisterContentTypedData({ ...baseArgs, policyFlags: 0xc1 })).toThrow(
      /reserved for moderator use/,
    );
  });

  it('throws when nonce exceeds Number.MAX_SAFE_INTEGER', () => {
    const tooBig = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(() => buildRegisterContentTypedData({ ...baseArgs, nonce: tooBig })).toThrow(
      /exceeds Number\.MAX_SAFE_INTEGER/,
    );
  });
});

describe('sprint2PlaceholderManifestCid', () => {
  const args = {
    videoUid: 'abcdef0123456789abcdef0123456789',
    owner: OWNER,
    createdAtSeconds: 1_700_000_000,
    keccak256,
  } as const;

  it('is deterministic — same inputs produce the same 32-byte hex output', () => {
    const a = sprint2PlaceholderManifestCid(args);
    const b = sprint2PlaceholderManifestCid(args);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('changes when the videoUid changes', () => {
    const a = sprint2PlaceholderManifestCid(args);
    const b = sprint2PlaceholderManifestCid({ ...args, videoUid: 'deadbeef' });
    expect(a).not.toBe(b);
  });

  it('changes when the owner changes', () => {
    const a = sprint2PlaceholderManifestCid(args);
    const b = sprint2PlaceholderManifestCid({
      ...args,
      owner: '0x1111111111111111111111111111111111111111',
    });
    expect(a).not.toBe(b);
  });

  it('changes when the timestamp changes', () => {
    const a = sprint2PlaceholderManifestCid(args);
    const b = sprint2PlaceholderManifestCid({
      ...args,
      createdAtSeconds: args.createdAtSeconds + 1,
    });
    expect(a).not.toBe(b);
  });
});
