import { readAeviaSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';
import {
  normaliseRegistrationMeta,
  persistRegistrationMeta,
  resolveLiveOwnership,
} from '../_lib/register-meta';

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
 * Sprint 2 ownership model: `live.defaultCreator` (or the round-trip-safe
 * `meta.creatorAddress` mirror) is the creator's wallet address and cannot
 * be forged — it is set at live-input creation time via the server-side
 * Cloudflare API call.
 *
 * Sibling route `/register-relayed` submits the on-chain tx on the
 * creator's behalf; shared validation + persistence helpers live in
 * `../_lib/register-meta.ts` so the two paths stay byte-compatible.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readAeviaSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const ownership = await resolveLiveOwnership(id, session.address);
  if (!ownership || !ownership.owned) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { live } = ownership;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = normaliseRegistrationMeta(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const meta = parsed.value;

  // Idempotency: if a manifest CID is already recorded for this live, refuse
  // to overwrite. The on-chain `ContentRegistry` itself rejects duplicate
  // registrations, but this guard ensures the client cannot accidentally
  // clobber an earlier successful record with a different one.
  if (live.meta?.manifestCid && live.meta.manifestCid !== meta.manifestCid) {
    return NextResponse.json({ error: 'manifestCid already set for this live' }, { status: 409 });
  }

  try {
    await persistRegistrationMeta(id, meta);
    return NextResponse.json(
      {
        ok: true,
        manifestCid: meta.manifestCid,
        txHash: meta.registerTxHash,
        block: meta.registerBlock,
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
