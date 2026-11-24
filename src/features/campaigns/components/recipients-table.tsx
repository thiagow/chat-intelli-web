'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrgId } from '@/hooks/use-org-query-key';
import { campaignsService, type RecipientStatus } from '../services/campaigns.service';
import { invalidReasonLabel, RECIPIENT_LABEL } from '../utils/labels';
import { inputCls } from './campaign-form-bits';

const TONE: Partial<Record<RecipientStatus, string>> = {
  SENT: 'text-zinc-600 dark:text-zinc-300',
  DELIVERED: 'text-blue-600 dark:text-blue-400',
  READ: 'text-emerald-600 dark:text-emerald-400',
  FAILED: 'text-red-600 dark:text-red-400',
  NOT_ON_WHATSAPP: 'text-amber-600 dark:text-amber-400',
  INVALID: 'text-red-600 dark:text-red-400',
};

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export function RecipientsTable({ campaignId }: { campaignId: string }) {
  const orgId = useOrgId();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RecipientStatus | ''>('');
  const [replied, setReplied] = useState(false);
  const pageSize = 25;

  const { data, isFetching } = useQuery({
    queryKey: ['campaign-recipients', orgId, campaignId, page, status, replied],
    queryFn: () => campaignsService.recipients(campaignId, { page, pageSize, status, replied }),
    placeholderData: keepPreviousData,
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Destinatários</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={replied}
              onChange={(e) => {
                setReplied(e.target.checked);
                setPage(1);
              }}
              className="size-3.5 rounded"
            />
            Só quem respondeu
          </label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as RecipientStatus | '');
              setPage(1);
            }}
            className={cn(inputCls, 'w-auto py-1.5 text-xs')}
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            {(Object.keys(RECIPIENT_LABEL) as RecipientStatus[]).map((s) => (
              <option key={s} value={s}>
                {RECIPIENT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={cn('overflow-x-auto rounded-xl border border-zinc-200 transition-opacity dark:border-white/10', isFetching && 'opacity-70')}>
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-white/[0.03]">
            <tr>
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Empresa</th>
              <th className="px-3 py-2.5 font-medium">Número</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Enviado</th>
              <th className="px-3 py-2.5 font-medium">Respondeu</th>
              <th className="w-8 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
            {data?.items.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-50/60 dark:hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 tabular-nums text-zinc-400">{r.rowNumber}</td>
                <td className="max-w-[220px] truncate px-3 py-2.5 font-medium">{r.companyName || '—'}</td>
                <td className="px-3 py-2.5 font-mono text-zinc-500">{r.phoneE164 ?? r.rawPhone}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('font-medium', TONE[r.status])}>{RECIPIENT_LABEL[r.status]}</span>
                  {(r.error || r.invalidReason) && (
                    <span className="block max-w-[240px] truncate text-[11px] text-zinc-500" title={r.error ?? r.invalidReason ?? ''}>
                      {invalidReasonLabel(r.error ?? r.invalidReason)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-zinc-500">{time(r.sentAt)}</td>
                <td className="px-3 py-2.5 tabular-nums text-zinc-500">
                  {time(r.repliedAt)}
                  {r.replyWebhookStatus && (
                    <span
                      className={cn(
                        'block text-[11px]',
                        r.replyWebhookStatus === 'SENT' ? 'text-emerald-600' : r.replyWebhookStatus === 'FAILED' ? 'text-red-500' : 'text-zinc-400',
                      )}
                      title={r.replyWebhookError ?? ''}
                    >
                      Webhook: {r.replyWebhookStatus === 'SENT' ? 'entregue' : r.replyWebhookStatus === 'FAILED' ? 'falhou' : 'enviando…'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {r.conversationId && (
                    <Link
                      href={`/inbox?conversationId=${r.conversationId}`}
                      className="text-zinc-400 hover:text-blue-600"
                      title="Abrir conversa"
                      aria-label="Abrir conversa"
                    >
                      <MessageSquare className="size-4" />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                  Nenhum destinatário neste filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span className="tabular-nums">{data?.total.toLocaleString('pt-BR') ?? 0} resultados</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg p-1.5 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-white/5" aria-label="Página anterior">
            <ChevronLeft className="size-4" />
          </button>
          <span className="tabular-nums">
            {page} / {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg p-1.5 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-white/5" aria-label="Próxima página">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
