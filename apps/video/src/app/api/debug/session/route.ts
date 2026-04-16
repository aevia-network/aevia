import { diagnoseSession } from '@aevia/auth/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const diag = await diagnoseSession();
  return NextResponse.json(diag, {
    headers: { 'cache-control': 'no-store' },
  });
}
