import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  title: string;
  description?: string;
}

export function Stepper({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <ol className="flex items-start gap-2" aria-label="Etapas">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.title} className="flex flex-1 items-start gap-3" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition',
                done && 'bg-emerald-500 text-white',
                active && 'bg-blue-600 text-white ring-4 ring-blue-600/15',
                !done && !active && 'bg-zinc-200 text-zinc-500 dark:bg-white/10 dark:text-zinc-400',
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={cn('block text-sm font-medium', !active && !done && 'text-zinc-500')}>{s.title}</span>
              {s.description && <span className="block text-xs text-zinc-500">{s.description}</span>}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className="mt-3 hidden h-px flex-1 bg-zinc-200 sm:block dark:bg-white/10" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
