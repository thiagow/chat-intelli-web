'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOrgId } from '@/hooks/use-org-query-key';
import { apiErrorMessage, campaignsService, type Campaign, type CampaignEstimate } from '../services/campaigns.service';
import { Section, inputCls } from './campaign-form-bits';

/**
 * Rodízio entre chips: escolhe os canais que enviam esta campanha e o teto diário de cada um. O canal da
 * importação é o primário (fixo; seu teto é o campo "Envios por dia"). Cada chip tem a própria cadeia de
 * lotes, com pausas e variação de início independentes, e os destinatários são divididos pelo teto.
 */
export function ChipsSection({
  campaign,
  campaignId,
  primaryDailyCap,
  onEstimate,
}: {
  campaign: Campaign | undefined;
  campaignId: string;
  /** Teto do chip primário (vem do formulário). */
  primaryDailyCap: number;
  onEstimate: (e: CampaignEstimate | undefined) => void;
}) {
  const orgId = useOrgId();
  const { data: caps } = useQuery({ queryKey: ['campaign-capabilities', orgId], queryFn: campaignsService.capabilities });
  const [limits, setLimits] = useState<Record<string, number>>({}); // só os chips extras selecionados
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  // Estado inicial: chips extras já gravados na campanha.
  useEffect(() => {
    if (!campaign || loaded.current) return;
    loaded.current = true;
    const next: Record<string, number> = {};
    for (const c of campaign.channels ?? []) if (!c.isPrimary) next[c.channelId] = c.dailyLimit;
    setLimits(next);
  }, [campaign]);

  const primaryId = campaign?.channelId;
  const others = useMemo(() => (caps?.channels ?? []).filter((c) => c.id !== primaryId), [caps, primaryId]);

  // Salva (debounce) quando a seleção ou os limites mudam. O primário sempre entra.
  const payload = useMemo(() => {
    if (!primaryId) return null;
    return [
      { channelId: primaryId, dailyLimit: primaryDailyCap },
      ...Object.entries(limits).map(([channelId, dailyLimit]) => ({ channelId, dailyLimit })),
    ];
  }, [primaryId, primaryDailyCap, limits]);
  const key = JSON.stringify(payload);
  const first = useRef(true);

  useEffect(() => {
    if (!loaded.current || !payload) return;
    if (first.current) {
      first.current = false; // a primeira passada só reflete o que já está salvo
      return;
    }
    if (!Number.isInteger(primaryDailyCap) || primaryDailyCap < 1) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await campaignsService.setChannels(campaignId, payload);
        onEstimate(res.estimate);
      } catch (e) {
        toast.error(apiErrorMessage(e));
      } finally {
        setSaving(false);
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!campaign || !caps) return null;
  if (!others.length) {
    return (
      <Section title="Canais de envio" description="Hoje só há um canal com envio em massa disponível; o rodízio aparece quando houver mais de um.">
        <p className="text-sm text-zinc-500">
          Canal desta campanha: <span className="font-medium text-zinc-900 dark:text-zinc-100">{campaign.channel?.name}</span>
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Canais de envio (rodízio)"
      description="Vários números enviam em paralelo, cada um com o próprio teto diário, pausas e horário de início. Os contatos são divididos entre os números de forma proporcional ao teto — isso espalha o volume e reduz o risco de bloqueio de um número só."
    >
      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-white/5 dark:border-white/10">
        <li className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2">
            <Lock className="size-3.5 shrink-0 text-zinc-400" aria-hidden />
            <span className="truncate text-sm font-medium">{campaign.channel?.name}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-white/10">principal</span>
          </span>
          <span className="shrink-0 text-xs tabular-nums text-zinc-500">{primaryDailyCap.toLocaleString('pt-BR')}/dia</span>
        </li>
        {others.map((c) => {
          const on = c.id in limits;
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <label className="flex min-w-0 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 rounded border-zinc-300"
                  checked={on}
                  onChange={(e) =>
                    setLimits((prev) => {
                      const next = { ...prev };
                      if (e.target.checked) next[c.id] = primaryDailyCap;
                      else delete next[c.id];
                      return next;
                    })
                  }
                />
                <span className="truncate text-sm">{c.name}</span>
              </label>
              <span className={cn('flex shrink-0 items-center gap-1.5 text-xs', !on && 'invisible')}>
                <input
                  type="number"
                  min={1}
                  max={caps.limits.maxDailyCap}
                  aria-label={`Teto diário de ${c.name}`}
                  className={cn(inputCls, 'h-8 w-24 text-right')}
                  value={limits[c.id] ?? ''}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setLimits((prev) => ({ ...prev, [c.id]: Number.isFinite(n) && n > 0 ? Math.floor(n) : 1 }));
                  }}
                />
                /dia
              </span>
            </li>
          );
        })}
      </ul>
      {saving && (
        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Loader2 className="size-3 animate-spin" /> Atualizando a estimativa…
        </p>
      )}
    </Section>
  );
}
