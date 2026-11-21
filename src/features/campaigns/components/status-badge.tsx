import { cn } from '@/lib/utils';
import type { CampaignStatus } from '../services/campaigns.service';
import { STATUS_LABEL, STATUS_TONE } from '../utils/labels';

const TONES = {
  neutral: 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300',
  info: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'bg-red-500/10 text-red-700 dark:text-red-300',
} as const;

export function StatusBadge({ status, className }: { status: CampaignStatus; className?: string }) {
  const tone = STATUS_TONE[status];
  const live = status === 'RUNNING' || status === 'VALIDATING' || status === 'SUBMITTING';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        TONES[tone],
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full bg-current', live && 'animate-pulse')} />
      {STATUS_LABEL[status]}
    </span>
  );
}
