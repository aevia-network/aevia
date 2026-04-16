import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listLiveInputs } from '@/lib/cloudflare/stream-client';
import { readSession } from '@/lib/session/cookie';
import { MeshDot, VigilChip } from '@aevia/ui';
import { Radio, Video } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutAction } from '../actions';
import { LiveRow, type LiveRowData } from './live-row';

export const runtime = 'edge';
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await readSession();
  if (!session) redirect('/');

  let myLives: LiveRowData[] = [];
  try {
    const all = await listLiveInputs();
    myLives = all
      .filter((l) => l.defaultCreator === session.handle)
      .map((l) => ({
        uid: l.uid,
        state: (l.status?.current?.state as LiveRowData['state']) ?? 'disconnected',
        name: l.meta?.name ?? '',
        created: l.created,
      }))
      .sort((a, b) => (a.created < b.created ? 1 : -1));
  } catch {
    // If Cloudflare API is transiently unreachable, render empty list gracefully.
  }

  return (
    <main className="mx-auto max-w-[720px] px-6 py-8">
      <header className="mb-12 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-headline text-[20px] font-semibold tracking-tight">aevia</span>
          <MeshDot />
        </div>
        <Badge variant="outline" className="font-label text-[10px] lowercase tracking-wide">
          sessão anônima
        </Badge>
      </header>

      <section className="mb-10">
        <div className="flex items-center gap-2">
          <h1 className="font-headline text-3xl font-semibold tracking-tight lowercase">
            {session.handle}
          </h1>
          <VigilChip />
        </div>
        <p className="mt-2 font-label text-[11px] uppercase tracking-[0.15em] text-on-surface-variant">
          seu espaço de transmissão
        </p>
      </section>

      <section className="mb-12 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <Radio className="size-5 text-danger" />
              ir ao vivo
            </CardTitle>
            <CardDescription className="lowercase">
              transmita do navegador — baixa latência, vod automático, link compartilhável.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/live/new">começar transmissão</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <Video className="size-5 text-accent" />
              descobrir
            </CardTitle>
            <CardDescription className="lowercase">
              veja o que está no ar agora. toque em qualquer cartão para assistir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="lg">
              <Link href="/discover">explorar</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-headline text-xl font-semibold lowercase">suas transmissões</h2>
          {myLives.length > 0 && (
            <p className="font-label text-[11px] uppercase tracking-wider text-on-surface-variant">
              {myLives.length} {myLives.length === 1 ? 'transmissão' : 'transmissões'}
            </p>
          )}
        </div>

        {myLives.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-on-surface-variant text-sm lowercase">
              nenhuma transmissão ainda. a primeira aparecerá aqui — você poderá revê-la, renomeá-la
              ou apagá-la.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {myLives.map((l) => (
              <LiveRow key={l.uid} live={l} />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-16 text-on-surface-variant text-xs">
        <form action={signOutAction}>
          <button type="submit" className="lowercase underline underline-offset-4">
            sair
          </button>
        </form>
      </footer>
    </main>
  );
}
