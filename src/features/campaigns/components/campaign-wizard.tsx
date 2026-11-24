'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dropzone } from '@/components/ui/dropzone';
import { Stepper } from '@/components/ui/stepper';
import { cn } from '@/lib/utils';
import { useOrgId } from '@/hooks/use-org-query-key';
import {
  apiErrorMessage,
  campaignsService,
  CSV_TEMPLATE,
  type Campaign,
  type CampaignEstimate,
  type ImportReport,
} from '../services/campaigns.service';
import { configSchema, importSchema, type ConfigValues, type ImportValues } from '../schemas/campaign.schemas';
import { useCampaign } from '../hooks/use-campaign-live';
import { CONSENT_LABEL, invalidReasonLabel, RECIPIENT_LABEL, ROUTING_LABEL, WEEKDAYS } from '../utils/labels';
import { Field, Section, inputCls } from './campaign-form-bits';
import { ReplyHandoffSection } from './reply-handoff-section';
import { ChipsSection } from './chips-section';

const STEPS = [
  { title: 'Lista', description: 'Canal e CSV' },
  { title: 'Validação', description: 'Números e duplicados' },
  { title: 'Configuração', description: 'Ritmo e revisão' },
];

const OPT_OUT_FOOTER = 'Responda SAIR para não receber mais mensagens.';

export function CampaignWizard() {
  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-8">
      <Stepper steps={STEPS} current={step} />
      <div className="mt-10">
        {step === 0 && (
          <StepUpload
            onImported={(c, r) => {
              setCampaignId(c.id);
              setReport(r);
              setStep(1);
            }}
          />
        )}
        {step === 1 && campaignId && report && (
          <StepValidation campaignId={campaignId} report={report} onNext={() => setStep(2)} />
        )}
        {step === 2 && campaignId && <StepConfigure campaignId={campaignId} />}
      </div>
    </div>
  );
}

// ─── Passo 1 — canal + CSV ───────────────────────────────────────────

function StepUpload({ onImported }: { onImported: (c: Campaign, r: ImportReport) => void }) {
  const orgId = useOrgId();
  const [file, setFile] = useState<File | null>(null);
  const { data: caps } = useQuery({ queryKey: ['campaign-capabilities', orgId], queryFn: campaignsService.capabilities });

  const form = useForm<ImportValues>({
    resolver: zodResolver(importSchema),
    defaultValues: { channelId: '', name: '', consentNote: '' },
  });
  const consent = form.watch('consentSource');

  useEffect(() => {
    if (caps?.channels.length === 1) form.setValue('channelId', caps.channels[0].id);
  }, [caps, form]);

  const mutation = useMutation({
    mutationFn: (v: ImportValues) => campaignsService.import({ ...v, file: file! }),
    onSuccess: ({ campaign, report }) => onImported(campaign, report),
    onError: (e) => toast.error(apiErrorMessage(e, 'Não foi possível importar o arquivo')),
  });

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-campanha.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <form
      onSubmit={form.handleSubmit((v) => {
        if (!file) return toast.error('Envie o arquivo CSV');
        mutation.mutate(v);
      })}
      className="space-y-8"
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Quem vai receber?</h2>
        <p className="mt-1 text-sm text-zinc-500">
          O CSV precisa das colunas <span className="font-mono text-xs">whatsapp</span>,{' '}
          <span className="font-mono text-xs">empresa</span> e <span className="font-mono text-xs">mensagem</span>. Qualquer coluna extra vira variável: use{' '}
          <span className="font-mono text-xs">{'{{empresa}}'}</span>, <span className="font-mono text-xs">{'{{cidade}}'}</span>… e varie o texto com{' '}
          <span className="font-mono text-xs">{'{Olá|Oi|Tudo bem}'}</span>: cada destinatário recebe uma versão diferente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Canal de envio" error={form.formState.errors.channelId?.message}>
          <select className={inputCls} {...form.register('channelId')}>
            <option value="">Selecione…</option>
            {caps?.channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nome da campanha" error={form.formState.errors.name?.message}>
          <input className={inputCls} placeholder="Ex.: Prospecção padarias — novembro" {...form.register('name')} />
        </Field>
        <Field
          label="Origem da lista"
          hint="Fica gravada na campanha (LGPD)."
          error={form.formState.errors.consentSource?.message}
        >
          <select className={inputCls} defaultValue="" {...form.register('consentSource')}>
            <option value="">Selecione…</option>
            {Object.entries(CONSENT_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {consent === 'OUTRO' && (
          <Field label="Descreva a origem" error={form.formState.errors.consentNote?.message}>
            <input className={inputCls} {...form.register('consentNote')} />
          </Field>
        )}
      </div>

      <div className="space-y-3">
        <Dropzone
          file={file}
          onFile={setFile}
          maxBytes={caps?.limits.maxFileBytes}
          onReject={(m) => toast.error(m)}
          hint={`Até ${(caps?.limits.maxRows ?? 5000).toLocaleString('pt-BR')} linhas · 5 MB · UTF-8 ou Excel (;)`}
          disabled={mutation.isPending}
        />
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400">
          <Download className="size-3.5" /> Baixar CSV modelo
        </button>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={mutation.isPending || !file}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Importar e validar
        </button>
      </div>
    </form>
  );
}

// ─── Passo 2 — relatório de validação ───────────────────────────────

function StepValidation({ campaignId, report, onNext }: { campaignId: string; report: ImportReport; onNext: () => void }) {
  const { data: campaign } = useCampaign(campaignId);
  const stats = campaign?.stats ?? {};
  const validating = campaign?.status === 'VALIDATING';
  const failed = campaign?.status === 'FAILED';

  const checked = (stats.valid ?? 0) + (stats.notOnWhatsapp ?? 0);
  const toCheck = report.pending;
  const [filter, setFilter] = useState<string>('ALL');
  const rows = useMemo(
    () => (filter === 'ALL' ? report.rows : report.rows.filter((r) => r.status === filter)),
    [report.rows, filter],
  );

  const cards = [
    { label: 'Válidos', value: stats.valid ?? 0, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Sem WhatsApp', value: stats.notOnWhatsapp ?? 0, tone: 'text-amber-600 dark:text-amber-400' },
    { label: 'Inválidos', value: report.invalid, tone: 'text-red-600 dark:text-red-400' },
    { label: 'Duplicados', value: report.duplicate, tone: 'text-zinc-600 dark:text-zinc-300' },
    { label: 'Opt-out', value: report.optedOut, tone: 'text-zinc-600 dark:text-zinc-300' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Relatório de validação</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {report.total.toLocaleString('pt-BR')} linhas lidas. Cada número é confirmado no WhatsApp antes do envio.
        </p>
      </div>

      {validating && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium text-blue-700 dark:text-blue-300">
              <Loader2 className="size-4 animate-spin" /> Verificando números no WhatsApp…
            </span>
            <span className="tabular-nums text-zinc-500">
              {checked}/{toCheck}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-500/15">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${toCheck ? (checked / toCheck) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      {failed && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {campaign?.errorMessage ?? 'A validação falhou. Verifique a conexão do canal e importe novamente.'}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-5 dark:border-white/10 dark:bg-white/10">
        {cards.map((c) => (
          <div key={c.label} className="bg-white p-4 dark:bg-zinc-950">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{c.label}</dt>
            <dd className={cn('mt-1 text-2xl font-semibold tabular-nums', c.tone)}>{c.value.toLocaleString('pt-BR')}</dd>
          </div>
        ))}
      </dl>

      {report.rows.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Linhas que ficarão de fora</h3>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className={cn(inputCls, 'w-auto py-1 text-xs')}>
              <option value="ALL">Todas</option>
              {['INVALID', 'DUPLICATE', 'OPTED_OUT'].map((s) => (
                <option key={s} value={s}>
                  {RECIPIENT_LABEL[s as keyof typeof RECIPIENT_LABEL]}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-72 overflow-auto rounded-xl border border-zinc-200 dark:border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Linha</th>
                  <th className="px-3 py-2 font-medium">Número</th>
                  <th className="px-3 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {rows.map((r) => (
                  <tr key={r.rowNumber}>
                    <td className="px-3 py-2 tabular-nums text-zinc-500">{r.rowNumber}</td>
                    <td className="px-3 py-2 font-mono">{r.rawPhone || '—'}</td>
                    <td className="max-w-[200px] truncate px-3 py-2">{r.companyName || '—'}</td>
                    <td className="px-3 py-2">{invalidReasonLabel(r.reason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={validating || failed || (stats.valid ?? 0) === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {(stats.valid ?? 0) === 0 && !validating ? 'Nenhum número válido' : 'Configurar envio'}
        </button>
      </div>
    </div>
  );
}

// ─── Passo 3 — configuração + revisão ───────────────────────────────

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function StepConfigure({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const orgId = useOrgId();
  const { data: campaign } = useCampaign(campaignId);
  const [estimate, setEstimate] = useState<CampaignEstimate | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  const form = useForm<ConfigValues>({
    resolver: zodResolver(configSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      delayMinSec: 30,
      delayMaxSec: 90,
      dailyCap: 200,
      batchSize: 20,
      batchSizeMin: 12,
      startJitterMaxMin: 15,
      typingMinSec: 3,
      typingMaxSec: 6,
      batchPauseMinMin: 5,
      batchPauseMaxMin: 15,
      sendWindowStart: '09:00',
      sendWindowEnd: '18:00',
      sendWeekdays: [1, 2, 3, 4, 5],
      scheduledAt: '',
      replyRouting: 'CHANNEL_DEFAULT',
      maxFailureRatePct: 15,
      appendOptOutFooter: true,
      replyAiContext: '',
    },
  });

  useEffect(() => {
    if (!campaign || loaded.current) return;
    loaded.current = true;
    form.reset({
      name: campaign.name,
      delayMinSec: campaign.delayMinSec,
      delayMaxSec: campaign.delayMaxSec,
      dailyCap: campaign.dailyCap,
      batchSize: campaign.batchSize,
      batchSizeMin: campaign.batchSizeMin,
      startJitterMaxMin: campaign.startJitterMaxMin,
      typingMinSec: Math.round(campaign.typingMinMs / 1000),
      typingMaxSec: Math.round(campaign.typingMaxMs / 1000),
      batchPauseMinMin: Math.max(1, Math.round(campaign.batchPauseMinSec / 60)),
      batchPauseMaxMin: Math.max(1, Math.round(campaign.batchPauseMaxSec / 60)),
      sendWindowStart: campaign.sendWindowStart,
      sendWindowEnd: campaign.sendWindowEnd,
      sendWeekdays: campaign.sendWeekdays,
      scheduledAt: toLocalInput(campaign.scheduledAt),
      replyRouting: campaign.replyRouting,
      maxFailureRatePct: campaign.maxFailureRatePct,
      appendOptOutFooter: campaign.appendOptOutFooter,
      replyAiContext: campaign.replyAiContext ?? '',
    });
    setEstimate(campaign.estimate);
  }, [campaign, form]);

  const values = form.watch();
  const { isValid, errors } = form.formState;

  const payloadOf = useCallback(
    (v: ConfigValues) => {
      const { batchPauseMinMin, batchPauseMaxMin, typingMinSec, typingMaxSec, ...rest } = v;
      return {
        ...rest,
        typingMinMs: typingMinSec * 1000,
        typingMaxMs: typingMaxSec * 1000,
        batchPauseMinSec: batchPauseMinMin * 60,
        batchPauseMaxSec: batchPauseMaxMin * 60,
        scheduledAt: v.scheduledAt ? new Date(v.scheduledAt).toISOString() : null,
      };
    },
    [],
  );

  // Autosave do rascunho (debounce) — a resposta traz a estimativa de duração.
  useEffect(() => {
    if (!loaded.current || !isValid) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        const updated = await campaignsService.update(campaignId, payloadOf(form.getValues()));
        setEstimate(updated.estimate);
      } catch (e) {
        toast.error(apiErrorMessage(e));
      } finally {
        setSaving(false);
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values), isValid]);

  const { data: sample } = useQuery({
    queryKey: ['campaign-sample', orgId, campaignId],
    queryFn: () => campaignsService.recipients(campaignId, { status: 'VALID', pageSize: 1 }),
  });
  const sampleRow = sample?.items[0];

  // Mesma renderização do envio (variáveis + spintax), com sementes diferentes: mostra a variação real.
  const { data: previewData } = useQuery({
    queryKey: ['campaign-preview', orgId, campaignId, values.appendOptOutFooter],
    queryFn: () => campaignsService.preview(campaignId, { n: 3, footer: values.appendOptOutFooter }),
    enabled: !!sampleRow,
  });

  const start = useMutation({
    mutationFn: async () => {
      await campaignsService.update(campaignId, payloadOf(form.getValues()));
      return campaignsService.start(campaignId);
    },
    onSuccess: () => {
      toast.success('Campanha iniciada');
      router.push(`/campaigns/${campaignId}`);
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Não foi possível iniciar')),
  });

  const err = (k: keyof ConfigValues) => errors[k]?.message as string | undefined;
  const num = { valueAsNumber: true } as const;

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-xl font-semibold tracking-tight">Ritmo e proteção do número</h2>
        <p className="mt-1 text-sm text-zinc-500">As alterações são salvas automaticamente.</p>
      </div>

      <Section title="Identificação">
        <Field label="Nome" error={err('name')}>
          <input className={inputCls} {...form.register('name')} />
        </Field>
      </Section>

      <Section title="Intervalo entre mensagens" description="A fila do WhatsApp sorteia um valor dentro da faixa a cada envio.">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Mínimo (s)" error={err('delayMinSec')}>
            <input type="number" className={inputCls} {...form.register('delayMinSec', num)} />
          </Field>
          <Field label="Máximo (s)" error={err('delayMaxSec')}>
            <input type="number" className={inputCls} {...form.register('delayMaxSec', num)} />
          </Field>
        </div>
      </Section>

      <Section
        title="Lotes e pausa entre lotes"
        description="O teto diário é dividido em lotes de tamanho sorteado. Entre um lote e outro o sistema espera um tempo aleatório, contado a partir do fim real do lote anterior — o ritmo não depende só da fila do WhatsApp."
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Mínimo por lote" error={err('batchSizeMin')} hint="Cada lote é sorteado entre o mínimo e o máximo">
            <input type="number" className={inputCls} {...form.register('batchSizeMin', num)} />
          </Field>
          <Field label="Máximo por lote" error={err('batchSize')}>
            <input type="number" className={inputCls} {...form.register('batchSize', num)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Pausa mínima entre lotes (min)" error={err('batchPauseMinMin')}>
            <input type="number" className={inputCls} {...form.register('batchPauseMinMin', num)} />
          </Field>
          <Field label="Pausa máxima entre lotes (min)" error={err('batchPauseMaxMin')} hint="Sempre uma faixa: pausa fixa é fácil de detectar">
            <input type="number" className={inputCls} {...form.register('batchPauseMaxMin', num)} />
          </Field>
        </div>
      </Section>

      <Section
        title="Naturalidade"
        description="Pequenas variações que evitam um padrão de robô: o dia não começa sempre na hora cheia e cada mensagem aparece como “digitando…” por alguns segundos."
      >
        <div className="grid grid-cols-3 gap-4">
          <Field label="Variação no início (até, min)" error={err('startJitterMaxMin')} hint="0 = começa na abertura da janela">
            <input type="number" className={inputCls} {...form.register('startJitterMaxMin', num)} />
          </Field>
          <Field label="Digitando… mín (s)" error={err('typingMinSec')}>
            <input type="number" className={inputCls} {...form.register('typingMinSec', num)} />
          </Field>
          <Field label="Digitando… máx (s)" error={err('typingMaxSec')} hint="0 = desligado">
            <input type="number" className={inputCls} {...form.register('typingMaxSec', num)} />
          </Field>
        </div>
      </Section>

      <ChipsSection campaign={campaign} campaignId={campaignId} primaryDailyCap={values.dailyCap} onEstimate={setEstimate} />

      <Section title="Teto e janela de envio" description="Campanhas grandes viram lotes diários. O restante continua no próximo dia útil.">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Envios por dia (por canal)" error={err('dailyCap')}>
            <input type="number" className={inputCls} {...form.register('dailyCap', num)} />
          </Field>
          <Field label="Início" error={err('sendWindowStart')}>
            <input type="time" className={inputCls} {...form.register('sendWindowStart')} />
          </Field>
          <Field label="Fim" error={err('sendWindowEnd')}>
            <input type="time" className={inputCls} {...form.register('sendWindowEnd')} />
          </Field>
        </div>
        <Controller
          control={form.control}
          name="sendWeekdays"
          render={({ field }) => (
            <div>
              <span className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Dias de envio</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = field.value.includes(d.value);
                  return (
                    <button
                      type="button"
                      key={d.value}
                      aria-pressed={on}
                      onClick={() => field.onChange(on ? field.value.filter((x) => x !== d.value) : [...field.value, d.value])}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                        on
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-white/15 dark:text-zinc-300',
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              {err('sendWeekdays') && <span className="mt-1 block text-xs text-red-500">{err('sendWeekdays')}</span>}
            </div>
          )}
        />
        <Field label="Agendar início (opcional)" error={err('scheduledAt')} hint="Vazio = começa assim que você iniciar.">
          <input type="datetime-local" className={inputCls} {...form.register('scheduledAt')} />
        </Field>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
          {estimate?.error ? (
            <p className="text-red-500">{estimate.error}</p>
          ) : estimate ? (
            <>
              <p className="tabular-nums">
                <span className="font-semibold">{estimate.recipients.toLocaleString('pt-BR')}</span> destinatários em{' '}
                <span className="font-semibold">{estimate.days} {estimate.days === 1 ? 'dia' : 'dias'}</span> de envio
                {estimate.batches !== undefined && <> · {estimate.batches} {estimate.batches === 1 ? 'lote' : 'lotes'}</>}
                {estimate.chips !== undefined && estimate.chips > 1 && <> · {estimate.chips} canais em paralelo</>}
                {estimate.estimatedEnd && <> · término previsto {new Date(estimate.estimatedEnd).toLocaleDateString('pt-BR')}</>}
              </p>
              {estimate.capLimitedByWindow && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  A janela só comporta {estimate.effectiveDailyCap?.toLocaleString('pt-BR')} envios/dia com esse intervalo e essas pausas entre lotes; o teto foi reduzido.
                </p>
              )}
            </>
          ) : (
            <p className="text-zinc-500">Calculando…</p>
          )}
          {saving && <p className="mt-1 text-[11px] text-zinc-400">Salvando…</p>}
        </div>
      </Section>

      <Section title="Quando responderem" description="A conversa só aparece no inbox quando o contato responde.">
        <Controller
          control={form.control}
          name="replyRouting"
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(ROUTING_LABEL) as Array<keyof typeof ROUTING_LABEL>).map((k) => (
                <button
                  type="button"
                  key={k}
                  aria-pressed={field.value === k}
                  onClick={() => field.onChange(k)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition',
                    field.value === k
                      ? 'border-blue-600 bg-blue-600/5 ring-1 ring-blue-600'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-white/10 dark:hover:border-white/20',
                  )}
                >
                  <span className="block text-sm font-medium">{ROUTING_LABEL[k].title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{ROUTING_LABEL[k].hint}</span>
                </button>
              ))}
            </div>
          )}
        />
      </Section>

      <ReplyHandoffSection campaign={campaign} campaignId={campaignId} register={form.register} aiContextError={err('replyAiContext')} />

      <Section title="Segurança" description="Pausa automática e aviso de descadastro.">
        <Field label="Pausar se a taxa de falha passar de (%)" error={err('maxFailureRatePct')} hint="Avaliada a partir de 30 envios.">
          <input type="number" className={cn(inputCls, 'max-w-32')} {...form.register('maxFailureRatePct', num)} />
        </Field>
        <Controller
          control={form.control}
          name="appendOptOutFooter"
          render={({ field }) => (
            <div>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-zinc-300"
                />
                <span className="text-sm">
                  Anexar “{OPT_OUT_FOOTER}”
                  <span className="block text-xs text-zinc-500">Quem responder SAIR — ou algo como “não tenho interesse” ou “tirar da lista” — vai para a lista de bloqueio, não recebe mais campanhas e a conversa é encerrada sem resposta automática.</span>
                </span>
              </label>
              {!field.value && (
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  Sem o aviso, as pessoas tendem a denunciar o número em vez de pedir para sair — o que aumenta o risco de bloqueio.
                </p>
              )}
            </div>
          )}
        />
      </Section>

      {previewData && previewData.variations.length > 0 && (
        <Section
          title="Prévia"
          description="Como a mensagem chega para o primeiro destinatário. Cada destinatário recebe uma variação sorteada."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {previewData.variations.map((text, i) => (
              <div key={i}>
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Variação {i + 1}</span>
                <div className="max-w-sm rounded-2xl rounded-tl-sm bg-emerald-600/10 p-3.5 text-sm leading-relaxed whitespace-pre-wrap dark:bg-emerald-500/10">
                  {text}
                </div>
              </div>
            ))}
          </div>
          {previewData.variables.length > 0 && (
            <p className="mt-3 text-xs text-zinc-500">
              Variáveis usadas: {previewData.variables.map((v) => `{{${v}}}`).join(', ')}
            </p>
          )}
        </Section>
      )}

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-zinc-200 pt-6 dark:border-white/10">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!isValid || saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            Revisar e iniciar
          </button>
        ) : (
          <div className="flex w-full items-center justify-between gap-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
            <p className="text-sm">
              Enviar para <b className="tabular-nums">{estimate?.recipients.toLocaleString('pt-BR')}</b> contatos, até{' '}
              <b className="tabular-nums">{estimate?.effectiveDailyCap}</b> por dia, entre {values.sendWindowStart} e {values.sendWindowEnd}?
            </p>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => setConfirming(false)} className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5">
                Voltar
              </button>
              <button
                onClick={() => start.mutate()}
                disabled={start.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {start.isPending && <Loader2 className="size-4 animate-spin" />} Iniciar campanha
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
