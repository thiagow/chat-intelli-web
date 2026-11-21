import { cn } from '@/lib/utils';

export const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.03]';

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-500">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
      )}
    </label>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-zinc-200 py-7 first:border-t-0 first:pt-0 md:grid-cols-[220px_1fr] dark:border-white/10">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
