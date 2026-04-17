import { getLiveInput, updateLiveInput } from '@/lib/cloudflare/stream-client';
import type { LiveInput } from '@/lib/cloudflare/types';

/**
 * Route-private helpers for persisting `registerContent` outcomes on the
 * Cloudflare Stream live input. Shared by the two registration routes
 * (`/register` — self-paid; `/register-relayed` — sponsored) so the meta
 * chip the dashboard renders is byte-identical regardless of who paid gas.
 *
 * Cloudflare Stream `meta` values MUST be strings. This module encodes and
 * validates the shape once, on the server side, so the two callers never
 * drift in their normalisation rules (e.g. lowercase hex, decimal-string
 * block numbers).
 */

const HEX32_RE = /^0x[0-9a-f]{64}$/;

export interface LiveOwnershipResult {
  live: LiveInput;
  /** `true` when the session address owns the live input. */
  owned: boolean;
}

/**
 * Resolve a live input and check ownership against the session address.
 *
 * Cloudflare drops the top-level `defaultCreator` field silently on many
 * account tiers — see `stream-client.ts#createLiveInput`. Prefer the
 * round-trip-safe `meta.creatorAddress` mirror and fall back to the
 * canonical field for legacy records backfilled out of band.
 */
export async function resolveLiveOwnership(
  uid: string,
  sessionAddress: string,
): Promise<LiveOwnershipResult | null> {
  const live = await getLiveInput(uid).catch(() => null);
  if (!live) return null;
  const me = sessionAddress.toLowerCase();
  const metaCreator = live.meta?.creatorAddress?.toLowerCase();
  const defaultCreator = live.defaultCreator?.toLowerCase();
  return { live, owned: metaCreator === me || defaultCreator === me };
}

export interface RegistrationMeta {
  /** 0x-prefixed 32-byte manifest CID (lowercase on write). */
  manifestCid: string;
  /** Transaction hash of the successful `registerContent` call. */
  registerTxHash: string;
  /** Block number of the successful `registerContent` call. */
  registerBlock: number;
  /**
   * Whether the transaction was sponsored by the platform relayer. Stored as
   * a string (`"1"` | `"0"`) because Cloudflare Stream `meta` values MUST be
   * strings. Absent on legacy records — the dashboard treats missing as `0`.
   */
  sponsored?: boolean;
}

export interface RegistrationMetaValidationError {
  field: 'manifestCid' | 'registerTxHash' | 'registerBlock';
  message: string;
}

/**
 * Validate a candidate registration-meta payload. Returns either the
 * normalised persistable record or a first-match error — callers surface
 * the error as a 400.
 */
export function normaliseRegistrationMeta(
  input: unknown,
):
  | { ok: true; value: Required<Omit<RegistrationMeta, 'sponsored'>> & { sponsored?: boolean } }
  | { ok: false; error: RegistrationMetaValidationError } {
  const body = (input ?? {}) as Partial<RegistrationMeta> & Record<string, unknown>;

  const manifestCid = typeof body.manifestCid === 'string' ? body.manifestCid.toLowerCase() : '';
  if (!HEX32_RE.test(manifestCid)) {
    return { ok: false, error: { field: 'manifestCid', message: 'invalid manifestCid' } };
  }

  const txHash = typeof body.registerTxHash === 'string' ? body.registerTxHash.toLowerCase() : '';
  if (!HEX32_RE.test(txHash)) {
    return { ok: false, error: { field: 'registerTxHash', message: 'invalid registerTxHash' } };
  }

  const rawBlock = body.registerBlock;
  const blockNum = typeof rawBlock === 'string' ? Number(rawBlock) : rawBlock;
  if (typeof blockNum !== 'number' || !Number.isFinite(blockNum) || blockNum < 0) {
    return { ok: false, error: { field: 'registerBlock', message: 'invalid registerBlock' } };
  }

  return {
    ok: true,
    value: {
      manifestCid,
      registerTxHash: txHash,
      registerBlock: blockNum,
      sponsored: body.sponsored === true ? true : undefined,
    },
  };
}

/**
 * Write the registration outcome to the live input's `meta`. Idempotent on
 * same-manifest overwrite and rejects diverging manifest CIDs (409 by the
 * route wrapper); callers pre-check the existing `live.meta.manifestCid`.
 */
export async function persistRegistrationMeta(
  uid: string,
  meta: Required<Omit<RegistrationMeta, 'sponsored'>> & { sponsored?: boolean },
): Promise<void> {
  const patch: Record<string, string> = {
    manifestCid: meta.manifestCid,
    registerTxHash: meta.registerTxHash,
    registerBlock: String(meta.registerBlock),
  };
  if (meta.sponsored) patch.sponsored = '1';
  await updateLiveInput(uid, { meta: patch });
}
