import type { CampaignStatus, ConsentSource, RecipientStatus, ReplyRouting } from '../services/campaigns.service';

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: 'Rascunho',
  VALIDATING: 'Validando números',
  READY: 'Pronta para iniciar',
  SUBMITTING: 'Enviando à fila',
  SCHEDULED: 'Agendada',
  RUNNING: 'Em andamento',
  PAUSED: 'Pausada',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  FAILED: 'Falhou',
};

export const STATUS_TONE: Record<CampaignStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  VALIDATING: 'info',
  READY: 'info',
  SUBMITTING: 'info',
  SCHEDULED: 'info',
  RUNNING: 'success',
  PAUSED: 'warning',
  COMPLETED: 'neutral',
  CANCELLED: 'neutral',
  FAILED: 'danger',
};

export const RECIPIENT_LABEL: Record<RecipientStatus, string> = {
  PENDING: 'Pendente',
  INVALID: 'Inválido',
  DUPLICATE: 'Duplicado',
  OPTED_OUT: 'Opt-out',
  NOT_ON_WHATSAPP: 'Sem WhatsApp',
  VALID: 'Válido',
  QUEUED: 'Na fila',
  SENT: 'Enviado',
  DELIVERED: 'Entregue',
  READ: 'Lido',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
};

export const INVALID_REASON_LABEL: Record<string, string> = {
  PHONE_EMPTY: 'Telefone vazio',
  PHONE_INVALID: 'Telefone inválido',
  MESSAGE_EMPTY: 'Mensagem vazia',
  MESSAGE_TOO_LONG: 'Mensagem acima de 4.096 caracteres',
  COMPANY_REQUIRED: 'Empresa vazia, mas a mensagem usa {{empresa}}',
  DUPLICATE_IN_FILE: 'Número repetido no arquivo',
  OPTED_OUT: 'Pediu para não receber mensagens',
};

/** Motivo legível de uma linha inválida/falha (aceita `VARIABLE_MISSING:cidade`). */
export function invalidReasonLabel(reason: string | null | undefined): string {
  if (!reason) return '';
  if (reason.startsWith('VARIABLE_MISSING:')) {
    return `A mensagem usa {{${reason.slice('VARIABLE_MISSING:'.length)}}}, mas a coluna está vazia nesta linha`;
  }
  return INVALID_REASON_LABEL[reason] ?? reason;
}

export const ROUTING_LABEL: Record<ReplyRouting, { title: string; hint: string }> = {
  CHANNEL_DEFAULT: { title: 'Padrão do canal', hint: 'Segue a regra atual de IA/humano do canal.' },
  AI: { title: 'IA responde', hint: 'A IA assume a conversa quando o contato responder.' },
  HUMAN: { title: 'Atendente humano', hint: 'A IA fica desligada; um atendente assume.' },
};

export const CONSENT_LABEL: Record<ConsentSource, string> = {
  CLIENTES_ATIVOS: 'Clientes ativos',
  LEADS_INBOUND: 'Leads que entraram em contato',
  PARCEIROS: 'Parceiros e indicações',
  OUTRO: 'Outra origem',
};

export const PAUSE_REASON_LABEL = (reason: string | null): string => {
  if (!reason) return 'Pausada manualmente';
  if (reason === 'FAILURE_RATE') return 'A taxa de falha passou do limite configurado. Verifique o número antes de retomar.';
  if (reason === 'CHANNEL_DISCONNECTED') return 'O canal desconectou. Reconecte a instância e retome.';
  if (reason.startsWith('SUBMIT_FAILED')) return 'Não foi possível enviar o lote ao provedor. Retome para tentar de novo.';
  return reason;
};

export const WEEKDAYS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

export const isActiveStatus = (s: CampaignStatus) =>
  ['VALIDATING', 'SUBMITTING', 'SCHEDULED', 'RUNNING'].includes(s);
