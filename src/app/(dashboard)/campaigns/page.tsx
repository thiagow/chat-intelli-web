'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Megaphone, Plus } from 'lucide-react';
import { useOrgId } from '@/hooks/use-org-query-key';
import { campaignsService } from '@/features/campaigns/services/campaigns.service';
import { useCampaignsList } from '@/features/campaigns/hooks/use-campaign-live';
import { StatusBadge } from '@/features/campaigns/components/status-badge';
import { CampaignProgressBar } from '@/features/campaigns/components/campaign-kpis';

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default function CampaignsPage() {
  const orgId = useOrgId();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useCampaignsList(page);
  const { data: caps } = useQuery({
    queryKey: ['campaign-capabilities', orgId],
    queryFn: campaignsService.capabilities,
  });

  const canCreate = !!caps?.enabled && (caps?.channels.length ?? 0) > 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-200 px-8 py-6 dark:border-white/10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Outbound</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Campanhas</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">
              Dispare a primeira mensagem para listas de empresas, com intervalo aleatório, teto diário e janela de
              horário para proteger o número.
            </p>
          </div>
          {canCreate ? (
            <Link
              href="/campaigns/new"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              <Plus className="size-4" /> Nova campanha
            </Link>
          ) : (
            <span
              className="cursor-not-allowed rounded-lg bg-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-500 dark:bg-white/10"
              title={caps && !caps.enabled ? 'Campanhas desativadas neste ambiente' : 'Nenhum canal com envio em massa'}
            >
              Nova campanha
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading && <p className="text-sm text-zinc-500">Carregando…</p>}
        {isError && <p className="text-sm text-red-500">Não foi possível carregar as campanhas.</p>}

        {data && data.items.length === 0 && (
          <div className="mx-auto mt-16 max-w-md text-center">
            <Megaphone className="mx-auto size-9 text-zinc-400" />
            <h2 className="mt-4 text-lg font-semibold">Nenhuma campanha ainda</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Suba um CSV com <span className="font-mono text-xs">whatsapp, empresa, mensagem</span>. Quem responder vira
              conversa no inbox — o resto fica fora dele.
            </p>
          </div>
        )}

        {data && data.items.length > 0 && (
          <>
            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-white/10 dark:border-white/10">
              {data.items.map((c) => {
                const s = c.stats ?? {};
                return (
                  <li key={c.id}>
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 bg-white px-5 py-4 transition hover:bg-zinc-50 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto] dark:bg-transparent dark:hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {c.channel?.name ?? 'Canal'} · {(s.total ?? 0).toLocaleString('pt-BR')} linhas ·{' '}
                          {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
                        <CampaignProgressBar stats={s} />
                        <p className="mt-1.5 text-xs text-zinc-500 tabular-nums">
                          {s.sent ?? 0}/{s.valid ?? 0} enviadas · {pct(s.replied ?? 0, s.sent ?? 0)}% responderam
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2 text-sm text-zinc-500">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg p-1.5 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-white/5"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="tabular-nums">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg p-1.5 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-white/5"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
