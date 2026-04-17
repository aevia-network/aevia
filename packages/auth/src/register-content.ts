/**
 * Client-safe helpers for on-chain manifest registration against the
 * Aevia `ContentRegistry` contract.
 *
 * This module is imported from client components (dashboard "registrar
 * on-chain" action) and from edge routes, so it MUST NOT import
 * `next/headers`, `node:*`, or any server-only module. It uses viem
 * primitive types only at the type level.
 *
 * Canonical deployed addresses are published in
 * `packages/contracts/deployments/<network>.json` and pinned into
 * `CONTENT_REGISTRY_ADDRESS` below. A missing entry for a given chain id
 * is a programmer error, not a runtime recoverable — callers MUST check
 * the chain id before attempting registration.
 *
 * Protocol reference: `docs/protocol-spec/1-manifest-schema.md` §6 and
 * `docs/adr/0002-content-registry-deployment.md`.
 */

import { AEVIA_CHAIN_ID_SEPOLIA } from './chains';

// ---------------------------------------------------------------------------
// Canonical deployments (see docs/adr/0002-content-registry-deployment.md)
// ---------------------------------------------------------------------------

/**
 * ContentRegistry address keyed by EIP-155 chain id.
 *
 * Sepolia: deployed 2026-04-17, tx `0xdfd8c57b69ea02311fa594144a37f16a419b1858e6eef2fb8e9da150ae458562`,
 * block `40345592`.
 * Mainnet: pending external audit; entry intentionally absent so any
 * accidental mainnet call throws early.
 */
export const CONTENT_REGISTRY_ADDRESS: Record<number, `0x${string}`> = {
  [AEVIA_CHAIN_ID_SEPOLIA]: '0x07ffbcB245bcD8aA08F8dA75B2AeDE750d5592F0',
};

/**
 * Returns the canonical ContentRegistry address for the given chain id, or
 * throws a descriptive error — callers at the edge of the system SHOULD
 * surface this as a user-facing failure rather than masking it.
 */
export function contentRegistryAddress(chainId: number): `0x${string}` {
  const address = CONTENT_REGISTRY_ADDRESS[chainId];
  if (!address) {
    throw new Error(
      `ContentRegistry is not deployed on chainId=${chainId}. ` +
        `Supported chains: ${Object.keys(CONTENT_REGISTRY_ADDRESS).join(', ')}`,
    );
  }
  return address;
}

// ---------------------------------------------------------------------------
// ABI — minimal surface used by the client flow.
// Mirrors `registerContent`, `nonces`, and the essential views from
// `packages/contracts/abi/ContentRegistry.json`. Keeping only the needed
// fragment avoids shipping the full ABI (28 entries) into the client bundle.
// ---------------------------------------------------------------------------

export const CONTENT_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'registerContent',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'manifestCid', type: 'bytes32' },
      { name: 'parentCid', type: 'bytes32' },
      { name: 'policyFlags', type: 'uint8' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'nonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isRegistered',
    stateMutability: 'view',
    inputs: [{ name: 'manifestCid', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'ContentRegistered',
    inputs: [
      { name: 'manifestCid', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'parentCid', type: 'bytes32', indexed: true },
      { name: 'timestamp', type: 'uint64', indexed: false },
      { name: 'policyFlags', type: 'uint8', indexed: false },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// EIP-712 typed data
// ---------------------------------------------------------------------------

/**
 * EIP-712 domain constants MUST match the on-chain contract:
 *
 *   string public constant DOMAIN_NAME = "Aevia ContentRegistry";
 *   string public constant DOMAIN_VERSION = "1";
 *
 * Any divergence produces a mismatched domain separator and the signature
 * fails verification inside `SignatureChecker.isValidSignatureNow`.
 */
export const CONTENT_REGISTRY_DOMAIN_NAME = 'Aevia ContentRegistry' as const;
export const CONTENT_REGISTRY_DOMAIN_VERSION = '1' as const;

/**
 * EIP-712 primary struct type. Field order MUST match
 * `REGISTER_TYPEHASH` in ContentRegistry.sol exactly:
 *
 *   RegisterContent(
 *     address owner,
 *     bytes32 manifestCid,
 *     bytes32 parentCid,
 *     uint8 policyFlags,
 *     uint256 chainId,
 *     uint256 nonce
 *   )
 */
export const REGISTER_CONTENT_TYPES = {
  RegisterContent: [
    { name: 'owner', type: 'address' },
    { name: 'manifestCid', type: 'bytes32' },
    { name: 'parentCid', type: 'bytes32' },
    { name: 'policyFlags', type: 'uint8' },
    { name: 'chainId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

export interface BuildRegisterContentTypedDataArgs {
  /** Owner address; MUST be the EIP-712 signer. Lowercase 0x-address. */
  owner: `0x${string}`;
  /** 32-byte manifest identifier. Zero is rejected on-chain. */
  manifestCid: `0x${string}`;
  /** Parent manifest CID (32 bytes). `0x0…0` when no parent. */
  parentCid: `0x${string}`;
  /** Creator-declared policy flags. Top bit (0x80) is reserved. */
  policyFlags: number;
  /** EIP-155 chain id (84532 for Base Sepolia). */
  chainId: number;
  /** Current nonce for `owner` — read from `nonces(owner)` immediately before signing. */
  nonce: bigint;
  /** Deployed ContentRegistry address on the target chain. */
  verifyingContract: `0x${string}`;
}

export interface RegisterContentTypedData {
  domain: {
    name: typeof CONTENT_REGISTRY_DOMAIN_NAME;
    version: typeof CONTENT_REGISTRY_DOMAIN_VERSION;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: typeof REGISTER_CONTENT_TYPES;
  primaryType: 'RegisterContent';
  message: {
    owner: `0x${string}`;
    manifestCid: `0x${string}`;
    parentCid: `0x${string}`;
    policyFlags: number;
    // uint256 fields emitted as plain JS numbers. Privy's modal `JSON.stringify`s
    // the message for preview and breaks on `bigint`; MetaMask, conversely,
    // misencodes decimal-string values for uint256 (hashes the UTF-8 bytes of
    // the string instead of parsing to a 32-byte word), which yields a
    // signature the on-chain ECDSA recovery rejects with `InvalidSignature`.
    // Plain numbers round-trip through JSON, hash correctly in viem's EIP-712
    // codec, and are safe here because Sprint 2 nonces start at 0 and stay
    // well under `Number.MAX_SAFE_INTEGER` for the foreseeable future.
    chainId: number;
    nonce: number;
  };
}

/**
 * Build the EIP-712 typed-data payload for `ContentRegistry.registerContent`.
 *
 * Shape is compatible with Privy's `useSignTypedData` (and viem's
 * `signTypedData`). Numeric fields that map to `uint256` on-chain (`chainId`,
 * `nonce`) are emitted as `bigint` so neither viem nor Privy silently
 * lossy-converts them through a JavaScript `number`. `policyFlags` maps to
 * `uint8` and fits comfortably in a JS number.
 *
 * The caller is responsible for:
 *   1. reading `nonces(owner)` from the deployed contract immediately before
 *      calling this function (stale nonces produce an InvalidSignature revert),
 *   2. providing a `manifestCid` the contract will accept (non-zero, not
 *      equal to `parentCid`, not already registered).
 */
export function buildRegisterContentTypedData(
  args: BuildRegisterContentTypedDataArgs,
): RegisterContentTypedData {
  const { owner, manifestCid, parentCid, policyFlags, chainId, nonce, verifyingContract } = args;

  if (policyFlags < 0 || policyFlags > 0xff) {
    throw new Error(`policyFlags out of uint8 range: ${policyFlags}`);
  }
  // RESERVED_POLICY_BIT mirrors ContentRegistry.sol; creators MUST NOT set it.
  if ((policyFlags & 0x80) !== 0) {
    throw new Error('policyFlags top bit (0x80) is reserved for moderator use');
  }

  if (nonce > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(
      `nonce ${nonce} exceeds Number.MAX_SAFE_INTEGER; typed-data emitter needs a bigint-safe path`,
    );
  }

  return {
    domain: {
      name: CONTENT_REGISTRY_DOMAIN_NAME,
      version: CONTENT_REGISTRY_DOMAIN_VERSION,
      chainId,
      verifyingContract,
    },
    types: REGISTER_CONTENT_TYPES,
    primaryType: 'RegisterContent',
    message: {
      owner,
      manifestCid,
      parentCid,
      policyFlags,
      chainId,
      nonce: Number(nonce),
    },
  };
}

// ---------------------------------------------------------------------------
// Sprint 2 placeholder manifest-CID derivation
// ---------------------------------------------------------------------------

/**
 * Derive a 32-byte placeholder manifest identifier for Sprint 2.
 *
 *   manifestCid = keccak256(bytes32(videoUid) || address(owner) || uint64(createdAtSeconds))
 *
 * This is NOT a real CIDv1. It is a deterministic, collision-resistant
 * placeholder that lets Sprint 2 exercise the end-to-end on-chain flow
 * before the Sprint 3 webhook pipeline emits a genuine
 * CIDv1 + binary-Merkle root. When Sprint 3 lands, new registrations MUST
 * use the real CIDv1 computed per `docs/protocol-spec/2-content-addressing.md`.
 *
 * Sprint 2 verifiers that encounter a manifest CID whose first byte does not
 * match a CIDv1 multibase/multicodec prefix MUST treat the entry as a
 * placeholder, not as a canonical content address.
 */
export function sprint2PlaceholderManifestCid(args: {
  /** Cloudflare Stream video UID. Hex or UTF-8 — bytes are padded to 32. */
  videoUid: string;
  /** Creator address (20 bytes). */
  owner: `0x${string}`;
  /** Registration time in epoch seconds. */
  createdAtSeconds: number;
  /** Injected `keccak256` implementation — caller provides viem's `keccak256`. */
  keccak256: (data: `0x${string}`) => `0x${string}`;
}): `0x${string}` {
  const { videoUid, owner, createdAtSeconds, keccak256 } = args;

  const videoHex = videoUidToBytes32(videoUid);
  const ownerHex = owner.toLowerCase().replace(/^0x/, '').padStart(40, '0');
  const tsHex = createdAtSeconds.toString(16).padStart(16, '0');

  return keccak256(`0x${videoHex}${ownerHex}${tsHex}` as `0x${string}`);
}

/**
 * Coerces a Cloudflare Stream UID (typically 32-hex chars, sometimes longer
 * with dashes) into a left-padded 32-byte hex string. Non-hex characters are
 * stripped; if the result is shorter than 64 hex chars it is right-padded
 * with zeros so every UID produces a unique bytes32.
 */
function videoUidToBytes32(videoUid: string): string {
  const hex = videoUid.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (hex.length >= 64) return hex.slice(0, 64);
  return hex.padEnd(64, '0');
}
