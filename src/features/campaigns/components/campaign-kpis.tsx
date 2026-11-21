import { cn } from '@/lib/utils';
import type { CampaignStats } from '../services/campaigns.service';

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function CampaignKpis({ stats }: { stats: Partial<CampaignStats> }) {
  const base = stats.valid ?? 0;
  const items = [
    { label: 'Enviadas', value: stats.sent ?? 0, of: base, tone: 'text-zinc-900 dark:text-white' },
    { label: 'Entregues', value: stats.delivered ?? 0, of: base, tone: 'text-blue-600 dark:text-blue-400' },
    { label: 'Lidas', value: stats.read ?? 0, of: base, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Respondidas', value: stats.replied ?? 0, of: stats.sent ?? 0, tone: 'text-violet-600 dark:text-violet-400' },
    { label: 'Falhas', value: stats.failed ?? 0, of: base, tone: 'text-red-600 dark:text-red-400' },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-5 dark:border-white/10 dark:bg-white/10">
      {items.map((i) => (
        <div key={i.label} className="bg-white p-4 dark:bg-zinc-950">
          <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{i.label}</dt>
          <dd className={cn('mt-1 text-3xl font-semibold tracking-tight tabular-nums', i.tone)}>
            {i.value.toLocaleString('pt-BR')}
          </dd>
          <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">{pct(i.value, i.of)}%</p>
        </div>
      ))}
    </dl>
  );
}

/** Barra segmentada: lido → entregue → enviado → na fila, mais falhas. */
export function CampaignProgressBar({ stats, className }: { stats: Partial<CampaignStats>; className?: string }) {
  const total = stats.valid ?? 0;
  if (!total) return <div className={cn('h-1.5 rounded-full bg-zinc-100 dark:bg-white/10', className)} />;
  const read = stats.read ?? 0;
  const delivered = Math.max(0, (stats.delivered ?? 0) - read);
  const sent = Math.max(0, (stats.sent ?? 0) - (stats.delivered ?? 0));
  const failed = stats.failed ?? 0;
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className={cn('flex h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={stats.sent ?? 0}
      aria-label="Progresso de envio"
    >
      <span className="bg-emerald-500 transition-all" style={{ width: seg(read) }} />
      <span className="bg-blue-500 transition-all" style={{ width: seg(delivered) }} />
      <span className="bg-zinc-400 transition-all dark:bg-zinc-500" style={{ width: seg(sent) }} />
      <span className="bg-red-500 transition-all" style={{ width: seg(failed) }} />
    </div>
  );
}
