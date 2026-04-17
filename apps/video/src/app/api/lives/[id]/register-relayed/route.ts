import { getRelayerEnv } from '@/lib/env';
import {
  AEVIA_CHAIN_ID_MAINNET,
  AEVIA_CHAIN_ID_SEPOLIA,
  CONTENT_REGISTRY_ABI,
  REGISTER_CONTENT_TYPES,
  contentRegistryAddress,
} from '@aevia/auth';
import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';
import { http, createPublicClient, createWalletClient, verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { persistRegistrationMeta, resolveLiveOwnership } from '../_lib/register-meta';

export const runtime = 'edge';

/**
 * Gas-sponsored registration for `ContentRegistry.registerContent`.
 *
 * Why this works without ERC-4337:
 *   - `ContentRegistry.registerContent` takes `owner` as an explicit argument
 *     and verifies an EIP-712 signature with OpenZeppelin's `SignatureChecker`
 *     (`ERC-1271` for contract owners, `ECDSA` for EOAs). `msg.sender` never
 *     matters — anyone can submit the tx as long as the signature over the
 *     (owner, manifestCid, parentCid, policyFlags, chainId, nonce) tuple
 *     verifies against `owner`.
 *   - This route validates the session, ownership of the live input, and the
 *     signature (off-chain, defense-in-depth) before paying gas from a
 *     dedicated throwaway relayer wallet (`RELAYER_PRIVATE_KEY`).
 *   - Rate limited to `MAX_FREE_REGISTRATIONS_PER_OWNER` registrations per
 *     owner address via Cloudflare KV (`AEVIA_RELAYER_COUNTS` binding). If
 *     KV is unbound at runtime the route falls back to an in-memory Map and
 *     logs a warning — rate limiting is then advisory only and DOES NOT
 *     survive Worker restarts. The main thread MUST add the binding before
 *     this is safe in production.
 *
 * Error surface (stable contract consumed by the client):
 *   401 unauthorized              — no session
 *   403 forbidden                 — session ≠ live creator, or body.owner ≠ session
 *   400 invalid_payload           — shape error on body
 *   400 signature_invalid         — off-line signature verification failed
 *   402 sponsorship_cap_exceeded  — owner used all free registrations
 *   409 already_registered        — on-chain record already exists for this manifest
 *   500 relayer_not_configured    — RELAYER_PRIVATE_KEY missing / malformed
 *   502 relayer_submission_failed — on-chain revert or RPC error
 *   504 relayer_timeout           — tx did not confirm within the budget
 */

const MAX_FREE_REGISTRATIONS_PER_OWNER = 10;
const RELAYER_TX_TIMEOUT_MS = 30_000;
const KV_BINDING = 'AEVIA_RELAYER_COUNTS';
const KV_KEY = (owner: string) => `owner:${owner.toLowerCase()}`;

// In-memory fallback counter. ONLY used when the KV binding is absent. This
// Map is per-isolate and effectively advisory — a cold start resets the
// count. The route emits a warning so the operator can't miss it.
const FALLBACK_COUNTS: Map<string, number> = new Map();

interface AeviaKvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

/**
 * Resolve the KV namespace binding out of `process.env` (the only interface
 * next-on-pages exposes for Pages Functions). Returns `null` when the
 * binding has not been added to `wrangler.toml` yet.
 */
function resolveKvBinding(): AeviaKvLike | null {
  const env = process.env as unknown as Record<string, unknown>;
  const raw = env[KV_BINDING];
  if (!raw) return null;
  if (typeof raw === 'string') return null; // stringified binding in misconfigured envs
  const candidate = raw as Partial<AeviaKvLike>;
  if (typeof candidate.get !== 'function' || typeof candidate.put !== 'function') return null;
  return candidate as AeviaKvLike;
}

async function readCount(owner: string): Promise<number> {
  const kv = resolveKvBinding();
  if (!kv) {
    console.warn(
      `[relayer] ${KV_BINDING} KV binding absent — falling back to in-memory counter (advisory only, resets on Worker restart).`,
    );
    return FALLBACK_COUNTS.get(owner.toLowerCase()) ?? 0;
  }
  const raw = await kv.get(KV_KEY(owner));
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function incrementCount(owner: string, next: number): Promise<void> {
  const kv = resolveKvBinding();
  if (!kv) {
    FALLBACK_COUNTS.set(owner.toLowerCase(), next);
    return;
  }
  await kv.put(KV_KEY(owner), String(next));
}

function appChainId(): number {
  return process.env.NEXT_PUBLIC_APP_ENV === 'production'
    ? AEVIA_CHAIN_ID_MAINNET
    : AEVIA_CHAIN_ID_SEPOLIA;
}

function appChain() {
  return process.env.NEXT_PUBLIC_APP_ENV === 'production' ? base : baseSepolia;
}

const HEX40 = /^0x[0-9a-fA-F]{40}$/;
const HEX64 = /^0x[0-9a-fA-F]{64}$/;
const SIG_HEX = /^0x[0-9a-fA-F]+$/;

interface RelayedRequest {
  owner: `0x${string}`;
  manifestCid: `0x${string}`;
  parentCid: `0x${string}`;
  policyFlags: number;
  signature: `0x${string}`;
}

function parseBody(raw: unknown): RelayedRequest | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'invalid_payload' };
  const b = raw as Partial<Record<keyof RelayedRequest, unknown>>;

  const owner = typeof b.owner === 'string' ? b.owner : '';
  const manifestCid = typeof b.manifestCid === 'string' ? b.manifestCid : '';
  const parentCid = typeof b.parentCid === 'string' ? b.parentCid : '';
  const signature = typeof b.signature === 'string' ? b.signature : '';
  const policyFlags = typeof b.policyFlags === 'number' ? b.policyFlags : -1;

  if (!HEX40.test(owner)) return { error: 'invalid_payload: owner' };
  if (!HEX64.test(manifestCid)) return { error: 'invalid_payload: manifestCid' };
  if (!HEX64.test(parentCid)) return { error: 'invalid_payload: parentCid' };
  if (!SIG_HEX.test(signature) || signature.length < 2 + 2 * 65) {
    return { error: 'invalid_payload: signature' };
  }
  if (policyFlags < 0 || policyFlags > 0xff) return { error: 'invalid_payload: policyFlags' };
  if ((policyFlags & 0x80) !== 0) return { error: 'invalid_payload: reserved policy bit' };

  return {
    owner: owner.toLowerCase() as `0x${string}`,
    manifestCid: manifestCid.toLowerCase() as `0x${string}`,
    parentCid: parentCid.toLowerCase() as `0x${string}`,
    policyFlags,
    signature: signature as `0x${string}`,
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  // ---- 1. Session ---------------------------------------------------------
  const session = await readAeviaSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // ---- 2. Relayer config (graceful 500 when missing) ----------------------
  const relayerEnv = getRelayerEnv();
  if (!relayerEnv) {
    return NextResponse.json({ error: 'relayer_not_configured' }, { status: 500 });
  }

  // ---- 3. Body shape ------------------------------------------------------
  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const parsed = parseBody(bodyRaw);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { owner, manifestCid, parentCid, policyFlags, signature } = parsed;

  // ---- 4. Ownership -------------------------------------------------------
  // The session's bound wallet MUST equal `owner` AND must equal the live
  // input's creator address. This prevents (a) a logged-in user from relaying
  // registrations for someone else's wallet and (b) a live-input owner from
  // registering a manifest under a different wallet they happen to control.
  if (owner !== session.address.toLowerCase()) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  const ownership = await resolveLiveOwnership(id, session.address);
  if (!ownership || !ownership.owned) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { live } = ownership;

  // Idempotency: if a different manifest CID is already recorded on this live
  // input, refuse to relay a new one. (The on-chain registry rejects duplicate
  // manifest CIDs, but the live input should only ever anchor one manifest.)
  if (live.meta?.manifestCid && live.meta.manifestCid !== manifestCid) {
    return NextResponse.json({ error: 'manifestCid already set for this live' }, { status: 409 });
  }

  // ---- 5. Sponsorship budget ---------------------------------------------
  const used = await readCount(owner);
  if (used >= MAX_FREE_REGISTRATIONS_PER_OWNER) {
    return NextResponse.json(
      {
        error: 'sponsorship_cap_exceeded',
        limit: MAX_FREE_REGISTRATIONS_PER_OWNER,
        used,
      },
      { status: 402 },
    );
  }

  // ---- 6. Off-line EIP-712 verification (defense in depth) ----------------
  // `verifyTypedData` does NOT handle ERC-1271 smart-wallet signatures; it
  // runs ECDSA recovery. For EOAs (Privy embedded wallet, MetaMask, Coinbase)
  // this is authoritative and saves the relayer a wasted gas quote. For
  // smart-wallet owners the on-chain `SignatureChecker.isValidSignatureNow`
  // is the canonical check — we proceed if the local verification fails
  // ONLY when the owner has deployed code (detected below).
  const chainId = appChainId();
  const chain = appChain();
  const registry = contentRegistryAddress(chainId);

  const publicClient = createPublicClient({
    chain,
    transport: http(relayerEnv.BASE_SEPOLIA_RPC_URL),
  });

  // Pull the on-chain nonce; the EIP-712 message signed by the user committed
  // to this value, so a stale nonce means someone already registered for the
  // owner — surface early rather than paying gas for a doomed tx.
  let nonce: bigint;
  try {
    nonce = (await publicClient.readContract({
      address: registry,
      abi: CONTENT_REGISTRY_ABI,
      functionName: 'nonces',
      args: [owner],
    })) as bigint;
  } catch (err) {
    return NextResponse.json(
      {
        error: 'relayer_submission_failed',
        reason: err instanceof Error ? err.message : 'rpc_read_failed',
      },
      { status: 502 },
    );
  }

  // Reconstruct the typed-data the client signed. viem's `verifyTypedData`
  // expects `uint256` fields as bigint; the client-side builder emits them
  // as plain numbers for Privy/MetaMask modal-preview compatibility, but
  // the EIP-712 digest viem computes from either representation is the same
  // because both round-trip through the same `encodeAbiParameters` of
  // `uint256`. Field order mirrors `REGISTER_TYPEHASH` in ContentRegistry.sol
  // — any divergence produces a different digest and both local + on-chain
  // verification fail the same way.
  const verifyMessage = {
    owner,
    manifestCid,
    parentCid,
    policyFlags,
    chainId: BigInt(chainId),
    nonce,
  };

  let ownerHasCode = false;
  try {
    const code = await publicClient.getCode({ address: owner });
    ownerHasCode = Boolean(code && code !== '0x');
  } catch {
    // Ignore — treat as EOA and enforce local verification.
  }

  if (!ownerHasCode) {
    try {
      const ok = await verifyTypedData({
        address: owner,
        domain: {
          name: 'Aevia ContentRegistry',
          version: '1',
          chainId,
          verifyingContract: registry,
        },
        types: REGISTER_CONTENT_TYPES,
        primaryType: 'RegisterContent',
        message: verifyMessage,
        signature,
      });
      if (!ok) {
        return NextResponse.json({ error: 'signature_invalid' }, { status: 400 });
      }
    } catch (err) {
      return NextResponse.json(
        {
          error: 'signature_invalid',
          reason: err instanceof Error ? err.message : 'verify_failed',
        },
        { status: 400 },
      );
    }
  }
  // For smart-wallet owners (ownerHasCode === true) the on-chain
  // `SignatureChecker` is the canonical check; `writeContract` will revert
  // with `InvalidSignature` and we surface that as 502 below.

  // ---- 7. Submit on-chain -------------------------------------------------
  const relayerAccount = privateKeyToAccount(relayerEnv.RELAYER_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account: relayerAccount,
    chain,
    transport: http(relayerEnv.BASE_SEPOLIA_RPC_URL),
  });

  let txHash: `0x${string}`;
  try {
    txHash = await walletClient.writeContract({
      address: registry,
      abi: CONTENT_REGISTRY_ABI,
      functionName: 'registerContent',
      args: [owner, manifestCid, parentCid, policyFlags, signature],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'write_failed';
    // A reverted simulation from viem often mentions `AlreadyRegistered` — map
    // it to 409 so the client can reconcile without re-prompting the user.
    if (/AlreadyRegistered/i.test(message)) {
      return NextResponse.json({ error: 'already_registered' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'relayer_submission_failed', reason: message },
      { status: 502 },
    );
  }

  // ---- 8. Await confirmation (bounded) -----------------------------------
  let block: number;
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: RELAYER_TX_TIMEOUT_MS,
    });
    if (receipt.status !== 'success') {
      return NextResponse.json(
        {
          error: 'relayer_submission_failed',
          reason: `reverted at block ${receipt.blockNumber}`,
          txHash,
        },
        { status: 502 },
      );
    }
    block = Number(receipt.blockNumber);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'timeout';
    const isTimeout = /timed? ?out|Timeout/i.test(message);
    return NextResponse.json(
      {
        error: isTimeout ? 'relayer_timeout' : 'relayer_submission_failed',
        reason: message,
        txHash,
      },
      { status: isTimeout ? 504 : 502 },
    );
  }

  // ---- 9. Persist meta + increment counter -------------------------------
  const nextCount = used + 1;
  await incrementCount(owner, nextCount);
  try {
    await persistRegistrationMeta(id, {
      manifestCid,
      registerTxHash: txHash,
      registerBlock: block,
      sponsored: true,
    });
  } catch (err) {
    // The on-chain record is already canonical — the meta is a cache. Log
    // and return success to the client; the dashboard will resync meta on
    // the next refresh via the `/register` path if needed.
    console.error('[relayer] persist meta failed (on-chain tx succeeded):', err);
  }

  return NextResponse.json(
    {
      ok: true,
      manifestCid,
      txHash,
      block,
      sponsored: true,
      remaining: Math.max(0, MAX_FREE_REGISTRATIONS_PER_OWNER - nextCount),
    },
    { status: 200 },
  );
}
