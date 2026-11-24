import { api } from '@/lib/api';

export type CampaignStatus =
  | 'DRAFT'
  | 'VALIDATING'
  | 'READY'
  | 'SUBMITTING'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type ReplyRouting = 'CHANNEL_DEFAULT' | 'AI' | 'HUMAN';
export type ConsentSource = 'CLIENTES_ATIVOS' | 'LEADS_INBOUND' | 'PARCEIROS' | 'OUTRO';

export type RecipientStatus =
  | 'PENDING'
  | 'INVALID'
  | 'DUPLICATE'
  | 'OPTED_OUT'
  | 'NOT_ON_WHATSAPP'
  | 'VALID'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'CANCELLED';

export interface CampaignStats {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  notOnWhatsapp: number;
  optedOut: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  cancelled: number;
  replied: number;
}

export interface CampaignEstimate {
  recipients: number;
  /** Quantidade de chips (canais) no rodízio. */
  chips?: number;
  days?: number;
  /** Quantidade de lotes (cada lote = uma pasta na UaZAPI). */
  batches?: number;
  effectiveDailyCap?: number;
  capLimitedByWindow?: boolean;
  firstBatchAt?: string | null;
  estimatedEnd?: string | null;
  error?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  channelId: string;
  channel?: { id: string; name: string; type: string };
  delayMinSec: number;
  delayMaxSec: number;
  scheduledAt: string | null;
  replyRouting: ReplyRouting;
  replyWindowDays: number;
  dailyCap: number;
  onReplyWebhookUrl: string | null;
  /** O segredo nunca é devolvido: só se já existe. */
  onReplyWebhookSecretSet: boolean;
  replyAiContext: string | null;
  batchSize: number;
  batchSizeMin: number;
  startJitterMaxMin: number;
  typingMinMs: number;
  typingMaxMs: number;
  batchPauseMinSec: number;
  batchPauseMaxSec: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  sendWeekdays: number[];
  maxFailureRatePct: number;
  appendOptOutFooter: boolean;
  consentSource: ConsentSource;
  consentNote: string | null;
  autoPausedReason: string | null;
  errorMessage: string | null;
  sourceFileName: string | null;
  stats: Partial<CampaignStats>;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  estimate?: CampaignEstimate;
  batches?: CampaignBatch[];
  /** Chips do rodízio (sempre inclui o canal principal). */
  channels?: CampaignChipRow[];
}

/** Progresso de um chip (canal) no rodízio. */
export interface CampaignChipRow {
  channelId: string;
  name: string;
  type: string;
  isPrimary: boolean;
  dailyLimit: number;
  stats: { queued: number; sent: number; delivered: number; read: number; failed: number };
}

export interface CampaignBatch {
  id: string;
  channelId?: string | null;
  batchIndex: number;
  scheduledFor: string;
  status: 'PLANNED' | 'SUBMITTING' | 'SCHEDULED' | 'RUNNING' | 'DONE' | 'CANCELLED' | 'FAILED';
  recipientCount: number;
}

export interface CampaignRecipientRow {
  id: string;
  rowNumber: number;
  rawPhone: string;
  phoneE164: string | null;
  companyName: string;
  messageText?: string;
  status: RecipientStatus;
  invalidReason: string | null;
  error: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  repliedAt: string | null;
  conversationId: string | null;
  /** Entrega do webhook de resposta. */
  replyWebhookStatus?: 'PENDING' | 'SENT' | 'FAILED' | null;
  replyWebhookError?: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ImportReport {
  total: number;
  pending: number;
  invalid: number;
  duplicate: number;
  optedOut: number;
  rows: Array<{
    rowNumber: number;
    rawPhone: string;
    companyName: string;
    status: RecipientStatus;
    reason: string | null;
  }>;
}

export interface CampaignCapabilities {
  enabled: boolean;
  channels: Array<{ id: string; name: string; type: string }>;
  limits: {
    maxRows: number;
    maxFileBytes: number;
    maxDailyCap: number;
    maxBatchSize?: number;
    minBatchPauseSec?: number;
    maxBatchPauseSec?: number;
    minDelaySec: number;
    maxDelaySec: number;
  };
}

export type UpdateCampaignPayload = Partial<
  Pick<
    Campaign,
    | 'name'
    | 'delayMinSec'
    | 'delayMaxSec'
    | 'replyRouting'
    | 'replyWindowDays'
    | 'dailyCap'
    | 'batchSize'
    | 'replyAiContext'
    | 'batchSizeMin'
    | 'startJitterMaxMin'
    | 'typingMinMs'
    | 'typingMaxMs'
    | 'batchPauseMinSec'
    | 'batchPauseMaxSec'
    | 'sendWindowStart'
    | 'sendWindowEnd'
    | 'sendWeekdays'
    | 'maxFailureRatePct'
    | 'appendOptOutFooter'
  >
> & { scheduledAt?: string | null; onReplyWebhookUrl?: string | null };

/** Mensagem legível de um erro do axios / da API. */
export function apiErrorMessage(err: unknown, fallback = 'Algo deu errado'): string {
  const e = err as { response?: { data?: { message?: string | string[]; error?: { message?: string } } }; message?: string };
  const m = e?.response?.data?.message ?? e?.response?.data?.error?.message;
  if (Array.isArray(m)) return m.join(' · ');
  return m || e?.message || fallback;
}

const unwrap = <T>(res: { data: { data?: T } & T }): T => (res.data.data ?? res.data) as T;

export const campaignsService = {
  async capabilities(): Promise<CampaignCapabilities> {
    return unwrap(await api.get('/campaigns/capabilities'));
  },

  async list(page = 1, pageSize = 20): Promise<Paginated<Campaign>> {
    return unwrap(await api.get('/campaigns', { params: { page, pageSize } }));
  },

  async get(id: string): Promise<Campaign> {
    return unwrap(await api.get(`/campaigns/${id}`));
  },

  async recipients(
    id: string,
    params: { page?: number; pageSize?: number; status?: RecipientStatus | ''; replied?: boolean },
  ): Promise<Paginated<CampaignRecipientRow>> {
    return unwrap(
      await api.get(`/campaigns/${id}/recipients`, {
        params: { ...params, status: params.status || undefined, replied: params.replied || undefined },
      }),
    );
  },

  async import(payload: {
    file: File;
    channelId: string;
    name: string;
    consentSource: ConsentSource;
    consentNote?: string;
  }): Promise<{ campaign: Campaign; report: ImportReport }> {
    const form = new FormData();
    form.append('file', payload.file);
    form.append('channelId', payload.channelId);
    form.append('name', payload.name);
    form.append('consentSource', payload.consentSource);
    if (payload.consentNote) form.append('consentNote', payload.consentNote);
    return unwrap(
      await api.post('/campaigns/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      }),
    );
  },

  async update(id: string, payload: UpdateCampaignPayload): Promise<Campaign & { webhookSecret?: string }> {
    return unwrap(await api.patch(`/campaigns/${id}`, payload));
  },

  /** O segredo vem em `webhookSecret` UMA vez (quando é gerado); depois só `onReplyWebhookSecretSet`. */
  async rotateWebhookSecret(id: string): Promise<{ webhookSecret: string }> {
    return unwrap(await api.post(`/campaigns/${id}/webhook-secret`));
  },

  async testWebhook(id: string): Promise<{ ok: boolean; status: number; error?: string }> {
    return unwrap(await api.post(`/campaigns/${id}/webhook-test`));
  },

  async setChannels(
    id: string,
    channels: Array<{ channelId: string; dailyLimit: number }>,
  ): Promise<{ channels: CampaignChipRow[]; estimate: CampaignEstimate }> {
    return unwrap(await api.put(`/campaigns/${id}/channels`, { channels }));
  },

  async preview(id: string, opts: { n?: number; footer?: boolean } = {}): Promise<CampaignPreview> {
    return unwrap(await api.get(`/campaigns/${id}/preview`, { params: { n: opts.n ?? 3, footer: opts.footer } }));
  },

  async start(id: string) {
    return unwrap<{ batches: number; effectiveDailyCap: number; estimatedEnd: string | null }>(
      await api.post(`/campaigns/${id}/start`),
    );
  },

  async pause(id: string): Promise<Campaign> {
    return unwrap(await api.post(`/campaigns/${id}/pause`));
  },
  async resume(id: string): Promise<Campaign> {
    return unwrap(await api.post(`/campaigns/${id}/resume`));
  },
  async cancel(id: string): Promise<Campaign> {
    return unwrap(await api.post(`/campaigns/${id}/cancel`));
  },
  async sendNow(id: string) {
    return unwrap<{ batchesStarted: number }>(await api.post(`/campaigns/${id}/send-now`));
  },
};

export const CSV_TEMPLATE =
  'whatsapp,empresa,cidade,mensagem\n' +
  '11999998888,Padaria Central,Goiânia,"{Olá|Oi|Tudo bem}, equipe da {{empresa}} de {{cidade}}! {Posso|Gostaria de} te mostrar como atender seus clientes mais rápido?"\n';

export interface CampaignPreview {
  /** Variações renderizadas (sementes diferentes) com um destinatário real. */
  variations: string[];
  /** Variáveis {{...}} usadas no modelo. */
  variables: string[];
  sample: { companyName: string } | null;
}
