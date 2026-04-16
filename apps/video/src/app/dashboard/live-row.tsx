'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PermanenceStrip } from '@aevia/ui';
import { Check, Pencil, Radio, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { deleteLiveAction, renameLiveAction } from '../actions';

export interface LiveRowData {
  uid: string;
  state: 'connected' | 'disconnected' | 'unknown';
  name: string;
  created: string;
}

export function LiveRow({ live }: { live: LiveRowData }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(live.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const createdLabel = new Date(live.created).toLocaleString('pt-BR');

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const confirmAndDelete = (event: React.FormEvent<HTMLFormElement>) => {
    const ok = window.confirm(
      'apagar esta transmissão? o vídeo gravado também será removido. esta ação não pode ser desfeita.',
    );
    if (!ok) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {live.state === 'connected' ? (
            <Badge variant="live" className="font-label tracking-wide">
              <Radio className="mr-1 size-3" /> ao vivo
            </Badge>
          ) : (
            <Badge variant="outline" className="font-label tracking-wide">
              encerrada
            </Badge>
          )}
          <div className="min-w-0 flex-1">
            {editing ? (
              <form
                action={(formData) => {
                  formData.set('uid', live.uid);
                  formData.set('name', draft);
                  void renameLiveAction(formData);
                  setEditing(false);
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  name="name"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={120}
                  className="min-w-0 flex-1 rounded bg-surface-high px-2 py-1 font-label text-sm text-on-surface focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  aria-label="salvar"
                  className="px-2"
                >
                  <Check className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="cancelar"
                  className="px-2"
                  onClick={() => {
                    setDraft(live.name);
                    setEditing(false);
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-sm">{live.name || 'sem título'}</p>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="renomear"
                  className="text-on-surface-variant transition-colors hover:text-accent"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <div className="mt-1 flex items-center gap-2">
              <PermanenceStrip
                layers={live.state === 'connected' ? ['providers', 'edge'] : ['edge']}
                width={80}
              />
              <p className="font-label text-[10px] text-on-surface-variant">
                {createdLabel} · {live.uid.slice(0, 8)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="lowercase">
            <Link href={`/live/${live.uid}`}>assistir</Link>
          </Button>
          <form action={deleteLiveAction} onSubmit={confirmAndDelete}>
            <input type="hidden" name="uid" value={live.uid} />
            <Button type="submit" variant="destructive" size="sm" className="lowercase">
              <Trash2 className="size-3.5" />
              apagar
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
