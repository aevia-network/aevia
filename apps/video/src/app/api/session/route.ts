import { clearSession, createAnonSession, readSession } from '@/lib/session/cookie';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ session: null }, { status: 200 });
  return NextResponse.json({ session }, { status: 200 });
}

export async function POST() {
  const existing = await readSession();
  if (existing) {
    return NextResponse.json({ session: existing, created: false }, { status: 200 });
  }
  const session = await createAnonSession();
  return NextResponse.json({ session, created: true }, { status: 201 });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true }, { status: 200 });
}
