import { getLiveInput, updateLiveInput } from '@/lib/cloudflare/stream-client';
import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Persist the on-chain registration metadata for a live input after the
 * creator has successfully called `ContentRegistry.registerContent` from the
 * dashboard. The live's Cloudflare Stream `meta` object is updated with:
 *
 *   meta.manifestCid      — 0x-prefixed 32-byte manifest identifier
 *   meta.registerTxHash   — transaction hash on Base Sepolia
 *   meta.registerBlock    — block number (decimal string)
 *
 * This route is authoritative for the dashboard's "registered on-chain" chip
 * and MUST only be writable by the live's owner. The on-chain write itself
 * is already recorded on Base Sepolia; this endpoint is purely a UX cache so
 * the dashboard does not have to re-scan the chain on every render.
 *
 * Sprint 2 ownership model: `live.defaultCreator` is the creator's wallet
 * address and cannot be forged (set at live-input creation time via the
 * server-side Cloudflare API call).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readAeviaSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const live = await getLiveInput(id).catch(() => null);
  const me = session.address.toLowerCase();
  // Cloudflare drops the top-level `defaultCreator` field silently on many
  // account tiers — see `stream-client.ts#createLiveInput`. Prefer the
  // round-trip-safe `meta.creatorAddress` mirror and fall back to the
  // canonical field for legacy records backfilled out of band.
  const metaCreator = live?.meta?.creatorAddress?.toLowerCase();
  const defaultCreator = live?.defaultCreator?.toLowerCase();
  if (!live || (metaCreator !== me && defaultCreator !== me)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: {
    manifestCid?: string;
    registerTxHash?: string;
    registerBlock?: number | string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const manifestCid = body.manifestCid?.toLowerCase();
  const txHash = body.registerTxHash?.toLowerCase();
  const blockNumber = body.registerBlock;

  // Shape validation. Manifest CID and tx hash are 32 bytes each; block
  // number is a non-negative integer. Cloudflare Stream's meta values MUST
  // be strings, so everything is normalized to string before storage.
  if (!manifestCid || !/^0x[0-9a-f]{64}$/.test(manifestCid)) {
    return NextResponse.json({ error: 'invalid manifestCid' }, { status: 400 });
  }
  if (!txHash || !/^0x[0-9a-f]{64}$/.test(txHash)) {
    return NextResponse.json({ error: 'invalid registerTxHash' }, { status: 400 });
  }
  const blockNum = typeof blockNumber === 'string' ? Number(blockNumber) : blockNumber;
  if (typeof blockNum !== 'number' || !Number.isFinite(blockNum) || blockNum < 0) {
    return NextResponse.json({ error: 'invalid registerBlock' }, { status: 400 });
  }

  // Idempotency: if a manifest CID is already recorded for this live, refuse
  // to overwrite. The on-chain `ContentRegistry` itself rejects duplicate
  // registrations, but this guard ensures the client cannot accidentally
  // clobber an earlier successful record with a different one.
  if (live.meta?.manifestCid && live.meta.manifestCid !== manifestCid) {
    return NextResponse.json({ error: 'manifestCid already set for this live' }, { status: 409 });
  }

  try {
    await updateLiveInput(id, {
      meta: {
        manifestCid,
        registerTxHash: txHash,
        registerBlock: String(blockNum),
      },
    });
    return NextResponse.json({ ok: true, manifestCid, txHash, block: blockNum }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
