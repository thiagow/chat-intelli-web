'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { UseFormRegister } from 'react-hook-form';
import { Check, Copy, KeyRound, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOrgId } from '@/hooks/use-org-query-key';
import { apiErrorMessage, campaignsService, type Campaign } from '../services/campaigns.service';
import type { ConfigValues } from '../schemas/campaign.schemas';
import { Field, Section, inputCls } from './campaign-form-bits';

const btn =
  'inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5';

/**
 * Handoff na resposta: webhook assinado (HMAC) + contexto para a IA. O webhook NÃO entra no autosave do
 * formulário (uma URL digitada pela metade seria recusada a cada tecla): tem botões explícitos, e o
 * segredo de assinatura só aparece uma vez, no momento em que é gerado.
 */
export function ReplyHandoffSection({
  campaign,
  campaignId,
  register,
  aiContextError,
}: {
  campaign: Campaign | undefined;
  campaignId: string;
  register: UseFormRegister<ConfigValues>;
  aiContextError?: string;
}) {
  const orgId = useOrgId();
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | 'rotate' | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const savedUrl = campaign?.onReplyWebhookUrl ?? '';
  useEffect(() => setUrl(savedUrl), [savedUrl]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['campaign', orgId, campaignId] });
  const dirty = url.trim() !== savedUrl;

  const save = async () => {
    setBusy('save');
    setUrlError(null);
    setTestResult(null);
    try {
      const res = await campaignsService.update(campaignId, { onReplyWebhookUrl: url.trim() || null });
      if (res.webhookSecret) setSecret(res.webhookSecret);
      if (!url.trim()) setSecret(null);
      toast.success(url.trim() ? 'Webhook salvo' : 'Webhook removido');
      await refresh();
    } catch (e) {
      setUrlError(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    setTestResult(null);
    try {
      const r = await campaignsService.testWebhook(campaignId);
      setTestResult({ ok: r.ok, text: r.ok ? `Entregue (HTTP ${r.status})` : r.error ?? `Recusado (HTTP ${r.status})` });
    } catch (e) {
      setTestResult({ ok: false, text: apiErrorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const rotate = async () => {
    if (!confirm('Gerar um novo segredo? O atual deixa de valer e o seu sistema precisa ser atualizado.')) return;
    setBusy('rotate');
    try {
      const r = await campaignsService.rotateWebhookSecret(campaignId);
      setSecret(r.webhookSecret);
      await refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <>
      <Section
        title="Contexto para a IA"
        description="Quando a IA assumir a conversa, ela recebe esta instrução junto com a mensagem que foi enviada. Opcional."
      >
        <Field label="O que a IA precisa saber sobre esta campanha" error={aiContextError} hint="Ex.: oferta, público, próximo passo (demo de 15 min), o que não prometer.">
          <textarea rows={4} maxLength={2000} className={cn(inputCls, 'h-auto py-2')} {...register('replyAiContext')} />
        </Field>
      </Section>

      <Section
        title="Webhook quando responderem"
        description="Um POST assinado é enviado ao seu sistema (agentes externos, CRM, gerador de demo…) quando um contato responde, com os dados do lead e o texto da resposta."
      >
        <Field label="URL (https)" error={urlError ?? undefined} hint="Tentativas automáticas com espera crescente se o seu sistema estiver fora do ar.">
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="https://seu-sistema.com/webhooks/campanha"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              inputMode="url"
              autoComplete="off"
            />
            <button type="button" onClick={save} disabled={!dirty || busy !== null} className={btn}>
              {busy === 'save' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar
            </button>
          </div>
        </Field>

        {savedUrl && !dirty && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={test} disabled={busy !== null} className={btn}>
              {busy === 'test' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar teste
            </button>
            <button type="button" onClick={rotate} disabled={busy !== null} className={btn}>
              {busy === 'rotate' ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Gerar novo segredo
            </button>
            {testResult && (
              <span role="status" className={cn('text-xs', testResult.ok ? 'text-emerald-600' : 'text-red-500')}>
                {testResult.text}
              </span>
            )}
          </div>
        )}

        {secret && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">Segredo de assinatura — copie agora, ele não será exibido de novo</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-black/5 px-2 py-1.5 font-mono text-xs dark:bg-white/10">{secret}</code>
              <button type="button" onClick={copy} className={btn} aria-label="Copiar segredo">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              Cada chamada traz <span className="font-mono">x-intelli-timestamp</span> e{' '}
              <span className="font-mono">x-intelli-signature</span> = <span className="font-mono">sha256=HMAC(segredo, timestamp + &quot;.&quot; + corpo)</span>.
              Valide a assinatura e rejeite timestamps antigos.
            </p>
          </div>
        )}
        {!secret && campaign?.onReplyWebhookSecretSet && savedUrl && (
          <p className="text-xs text-zinc-500">Segredo de assinatura já gerado. Para ver um novo valor, gere outro segredo.</p>
        )}
      </Section>
    </>
  );
}
