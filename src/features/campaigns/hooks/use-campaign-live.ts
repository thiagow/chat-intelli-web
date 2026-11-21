'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import { useOrgId } from '@/hooks/use-org-query-key';
import { campaignsService, type Campaign, type CampaignStats, type CampaignStatus } from '../services/campaigns.service';
import { isActiveStatus } from '../utils/labels';

interface ProgressEvent {
  campaignId: string;
  status: CampaignStatus;
  autoPausedReason?: string | null;
  stats: CampaignStats;
}

/**
 * Detalhe da campanha com atualização ao vivo: o socket (`campaign:progress`)
 * remenda o cache; o polling de 5s cobre queda de socket enquanto a campanha
 * está ativa (mesmo padrão do use-channel-sync).
 */
export function useCampaign(id: string) {
  const orgId = useOrgId();
  const qc = useQueryClient();
  const key = ['campaign', orgId, id] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => campaignsService.get(id),
    refetchInterval: (q) => {
      const status = (q.state.data as Campaign | undefined)?.status;
      return status && (isActiveStatus(status) || status === 'PAUSED') ? 5000 : false;
    },
  });

  useEffect(() => {
    const socket = getSocket();
    const onProgress = (e: ProgressEvent) => {
      if (e.campaignId !== id) return;
      qc.setQueryData<Campaign>(key, (old) =>
        old
          ? { ...old, status: e.status, stats: e.stats, autoPausedReason: e.autoPausedReason ?? old.autoPausedReason }
          : old,
      );
      // Lotes/estimativa mudam com o status; recarrega sem piscar.
      qc.invalidateQueries({ queryKey: ['campaign-recipients', orgId, id] });
    };
    const onAutoPaused = (e: { campaignId: string }) => {
      if (e.campaignId === id) qc.invalidateQueries({ queryKey: key });
    };
    socket.on('campaign:progress', onProgress);
    socket.on('campaign:auto-paused', onAutoPaused);
    socket.on('campaign:reply', onAutoPaused);
    return () => {
      socket.off('campaign:progress', onProgress);
      socket.off('campaign:auto-paused', onAutoPaused);
      socket.off('campaign:reply', onAutoPaused);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, orgId, qc]);

  return query;
}

/** Lista com refresh quando qualquer campanha da org emite progresso. */
export function useCampaignsList(page: number) {
  const orgId = useOrgId();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['campaigns', orgId, page],
    queryFn: () => campaignsService.list(page),
    refetchInterval: (q) => {
      const items = (q.state.data as { items: Campaign[] } | undefined)?.items ?? [];
      return items.some((c) => isActiveStatus(c.status)) ? 10000 : false;
    },
  });

  useEffect(() => {
    const socket = getSocket();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Progresso chega em rajada durante a validação: agrupa em 1 refetch por segundo.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => qc.invalidateQueries({ queryKey: ['campaigns', orgId] }), 1000);
    };
    socket.on('campaign:progress', refresh);
    return () => {
      clearTimeout(timer);
      socket.off('campaign:progress', refresh);
    };
  }, [orgId, qc]);

  return query;
}
