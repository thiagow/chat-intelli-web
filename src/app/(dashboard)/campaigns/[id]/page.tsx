'use client';

import { use } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Pause, Play, Square, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOrgId } from '@/hooks/use-org-query-key';
import { apiErrorMessage, campaignsService, type CampaignBatch } from '@/features/campaigns/services/campaigns.service';
import { useCampaign } from '@/features/campaigns/hooks/use-campaign-live';
import { StatusBadge } from '@/features/campaigns/components/status-badge';
import { CampaignKpis, CampaignProgressBar } from '@/features/campaigns/components/campaign-kpis';
import { RecipientsTable } from '@/features/campaigns/components/recipients-table';
import { PAUSE_REASON_LABEL } from '@/features/campaigns/utils/labels';

const BATCH_TONE: Record<CampaignBatch['status'], string> = {
  PLANNED: 'bg-zinc-300 dark:bg-zinc-600',
  SUBMITTING: 'bg-blue-400',
  SCHEDULED: 'bg-blue-500',
  RUNNING: 'bg-emerald-500 animate-pulse',
  DONE: 'bg-emerald-600',
  CANCELLED: 'bg-zinc-400',
  FAILED: 'bg-red-500',
};
const BATCH_LABEL: Record<CampaignBatch['status'], string> = {
  PLANNED: 'Planejado',
  SUBMITTING: 'Enviando à fila',
  SCHEDULED: 'Agendado',
  RUNNING: 'Em andamento',
  DONE: 'Concluído',
  CANCELLED: 'Cancelado',
  FAILED: 'Falhou',
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const orgId = useOrgId();
  const qc = useQueryClient();
  const { data: c, isLoading, isError } = useCampaign(id);

  const run = (fn: () => Promise<unknown>, ok: string) => ({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ['campaign', orgId, id] });
      qc.invalidateQueries({ queryKey: ['campaigns', orgId] });
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e)),
  });
  const start = useMutation(run(() => campaignsService.start(id), 'Campanha iniciada'));
  const pause = useMutation(run(() => campaignsService.pause(id), 'Campanha pausada'));
  const resume = useMutation(run(() => campaignsService.resume(id), 'Campanha retomada'));
  const cancel = useMutation(run(() => campaignsService.cancel(id), 'Campanha cancelada'));
  const sendNow = useMutation(run(() => campaignsService.sendNow(id), 'Lote antecipado'));

  if (isLoading) return <p className="p-8 text-sm text-zinc-500">Carregando…</p>;
  if (isError || !c) return <p className="p-8 text-sm text-red-500">Campanha não encontrada.</p>;

  const stats = c.stats ?? {};
  const canPause = ['SUBMITTING', 'SCHEDULED', 'RUNNING'].includes(c.status);
  const canCancel = !['COMPLETED', 'CANCELLED', 'FAILED'].includes(c.status);
  const canStart = ['DRAFT', 'READY'].includes(c.status);
  const busy = start.isPending || pause.isPending || resume.isPending || cancel.isPending || sendNow.isPending;

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-zinc-200 px-8 py-5 dark:border-white/10">
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
          <ArrowLeft className="size-4" /> Campanhas
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{c.name}</h1>
              <StatusBadge status={c.status} />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {c.channel?.name} · intervalo {c.delayMinSec}–{c.delayMaxSec}s · até {c.dailyCap}/dia · {c.sendWindowStart}–{c.sendWindowEnd}
              {c.sourceFileName && <> · {c.sourceFileName}</>}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canStart && (
              <button
                disabled={busy}
                onClick={() => confirm('Iniciar a campanha? As mensagens serão enviadas aos destinatários válidos.') && start.mutate()}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Play className="size-4" /> Iniciar campanha
              </button>
            )}
            {['SUBMITTING', 'SCHEDULED'].includes(c.status) && (
              <button
                disabled={busy}
                onClick={() => confirm('Antecipar o envio do lote agendado, fora do horário programado?') && sendNow.mutate()}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
              >
                <Zap className="size-4" /> Enviar agora
              </button>
            )}
            {canPause && (
              <button disabled={busy} onClick={() => pause.mutate()} className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5">
                <Pause className="size-4" /> Pausar
              </button>
            )}
            {c.status === 'PAUSED' && (
              <button disabled={busy} onClick={() => resume.mutate()} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                <Play className="size-4" /> Retomar
              </button>
            )}
            {canCancel && (
              <button
                disabled={busy}
                onClick={() => confirm('Cancelar a campanha? O que ainda não foi enviado não será enviado.') && cancel.mutate()}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50"
              >
                <Square className="size-4" /> Cancelar
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-8 px-8 py-6">
        {c.status === 'PAUSED' && (
          <div role="alert" className={cn('flex items-start gap-3 rounded-xl border p-4 text-sm', c.autoPausedReason ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200' : 'border-zinc-200 dark:border-white/10')}>
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">{c.autoPausedReason ? 'Pausa automática' : 'Campanha pausada'}</p>
              <p className="mt-0.5 opacity-90">{PAUSE_REASON_LABEL(c.autoPausedReason)}</p>
            </div>
          </div>
        )}
        {c.status === 'FAILED' && c.errorMessage && (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
            {c.errorMessage}
          </div>
        )}

        <CampaignKpis stats={stats} />

        <div>
          <CampaignProgressBar stats={stats} className="h-2" />
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-zinc-500">
            <Legend color="bg-emerald-500" label="Lidas" />
            <Legend color="bg-blue-500" label="Entregues" />
            <Legend color="bg-zinc-400" label="Enviadas" />
            <Legend color="bg-red-500" label="Falhas" />
            <span className="ml-auto tabular-nums">
              {stats.queued ?? 0} na fila · {stats.notOnWhatsapp ?? 0} sem WhatsApp · {stats.optedOut ?? 0} opt-out
            </span>
          </div>
        </div>

        {c.batches && c.batches.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold">Lotes</h2>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {c.batches.map((b) => (
                <li key={b.id} className="rounded-xl border border-zinc-200 p-3 dark:border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Lote {b.batchIndex + 1}</span>
                    <span className="flex items-center gap-1.5 text-zinc-500">
                      <span className={cn('size-1.5 rounded-full', BATCH_TONE[b.status])} />
                      {BATCH_LABEL[b.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-semibold tabular-nums">{b.recipientCount.toLocaleString('pt-BR')}</p>
                  <p className="text-[11px] text-zinc-500 tabular-nums">
                    {new Date(b.scheduledFor).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <RecipientsTable campaignId={id} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full', color)} />
      {label}
    </span>
  );
}
