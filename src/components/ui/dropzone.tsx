'use client';

import { useCallback, useRef, useState } from 'react';
import { FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropzoneProps {
  file: File | null;
  onFile: (file: File | null) => void;
  accept?: string;
  maxBytes?: number;
  onReject?: (reason: string) => void;
  hint?: string;
  disabled?: boolean;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Dropzone({
  file,
  onFile,
  accept = '.csv,text/csv',
  maxBytes,
  onReject,
  hint,
  disabled,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const pick = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      if (maxBytes && f.size > maxBytes) {
        onReject?.(`O arquivo tem ${formatBytes(f.size)}; o limite é ${formatBytes(maxBytes)}.`);
        return;
      }
      if (!/\.(csv|txt)$/i.test(f.name) && f.type !== 'text/csv') {
        onReject?.('Envie um arquivo .csv.');
        return;
      }
      onFile(f);
    },
    [maxBytes, onFile, onReject],
  );

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <FileSpreadsheet className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-zinc-500 tabular-nums">{formatBytes(file.size)}</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onFile(null)}
          className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-white"
          aria-label="Remover arquivo"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) pick(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        'group flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition',
        over
          ? 'border-blue-500 bg-blue-500/5'
          : 'border-zinc-300 hover:border-zinc-400 dark:border-white/15 dark:hover:border-white/30',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <UploadCloud className="size-7 text-zinc-400 transition group-hover:text-zinc-600 dark:group-hover:text-zinc-200" />
      <p className="text-sm font-medium">Arraste o CSV aqui ou clique para escolher</p>
      {hint && <p className="max-w-sm text-xs text-zinc-500">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
