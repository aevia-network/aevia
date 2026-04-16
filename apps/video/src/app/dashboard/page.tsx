import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listLiveInputs } from '@/lib/cloudflare/stream-client';
import { readSession } from '@/lib/session/cookie';
import { MeshDot, PermanenceStrip, VigilChip } from '@aevia/ui';
import { Radio, Trash2, Video } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { deleteLiveAction, signOutAction } from '../actions';

export const runtime = 'nodejs';
export const revalidate = 0;

interface LiveRow {
  uid: string;
  state: 'connected' | 'disconnected' | 'unknown';
  name: string;
  created: string;
}

export default async function DashboardPage() {
  const session = await readSession();
  if (!session) redirect('/');

  let myLives: LiveRow[] = [];
  try {
    const all = await listLiveInputs();
    myLives = all
      .filter((l) => l.defaultCreator === session.handle)
      .map((l) => ({
        uid: l.uid,
        state: (l.status?.current?.state as LiveRow['state']) ?? 'disconnected',
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
              nenhuma transmissão ainda. a primeira aparecerá aqui — você poderá revê-la ou
              apagá-la.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {myLives.map((l) => (
              <Card key={l.uid}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {l.state === 'connected' ? (
                      <Badge variant="live" className="font-label tracking-wide">
                        <Radio className="mr-1 size-3" /> ao vivo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-label tracking-wide">
                        encerrada
                      </Badge>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">{l.name || 'sem título'}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <PermanenceStrip
                          layers={l.state === 'connected' ? ['providers', 'edge'] : ['edge']}
                          width={80}
                        />
                        <p className="font-label text-[10px] text-on-surface-variant">
                          {new Date(l.created).toLocaleString('pt-BR')} · {l.uid.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/live/${l.uid}`}>assistir</Link>
                    </Button>
                    <form action={deleteLiveAction}>
                      <input type="hidden" name="uid" value={l.uid} />
                      <Button type="submit" variant="destructive" size="sm">
                        <Trash2 className="size-3.5" />
                        apagar
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
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
