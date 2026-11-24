import { z } from 'zod';

const HM = /^([01]?\d|2[0-3]):[0-5]\d$/;

export const importSchema = z
  .object({
    channelId: z.string().min(1, 'Escolha o canal'),
    name: z.string().trim().min(2, 'Dê um nome à campanha').max(120),
    consentSource: z.enum(['CLIENTES_ATIVOS', 'LEADS_INBOUND', 'PARCEIROS', 'OUTRO'], {
      message: 'Informe a origem da lista',
    }),
    consentNote: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.consentSource !== 'OUTRO' || !!v.consentNote?.length, {
    path: ['consentNote'],
    message: 'Descreva de onde veio a lista',
  });
export type ImportValues = z.infer<typeof importSchema>;

export const configSchema = z
  .object({
    name: z.string().trim().min(2, 'Dê um nome à campanha').max(120),
    delayMinSec: z.number({ message: 'Número' }).int().min(10, 'Mínimo de 10s').max(600),
    delayMaxSec: z.number({ message: 'Número' }).int().min(10, 'Mínimo de 10s').max(600, 'Máximo de 600s'),
    dailyCap: z.number({ message: 'Número' }).int().min(1, 'Mínimo 1').max(1000, 'Máximo 1.000/dia'),
    batchSize: z.number({ message: 'Número' }).int().min(1, 'Mínimo 1').max(500, 'Máximo 500 por lote'),
    // Na tela a pausa entre lotes é em minutos; o payload converte para segundos.
    batchPauseMinMin: z.number({ message: 'Número' }).int().min(1, 'Mínimo 1 min').max(180, 'Máximo 180 min'),
    batchPauseMaxMin: z.number({ message: 'Número' }).int().min(1, 'Mínimo 1 min').max(180, 'Máximo 180 min'),
    sendWindowStart: z.string().regex(HM, 'Horário inválido'),
    sendWindowEnd: z.string().regex(HM, 'Horário inválido'),
    sendWeekdays: z.array(z.number().int().min(0).max(6)).min(1, 'Escolha ao menos um dia'),
    scheduledAt: z.string().optional(),
    replyRouting: z.enum(['CHANNEL_DEFAULT', 'AI', 'HUMAN']),
    maxFailureRatePct: z.number({ message: 'Número' }).int().min(1).max(100),
    appendOptOutFooter: z.boolean(),
  })
  .refine((v) => v.delayMaxSec >= v.delayMinSec, {
    path: ['delayMaxSec'],
    message: 'Máximo menor que o mínimo',
  })
  .refine((v) => v.batchPauseMaxMin >= v.batchPauseMinMin, {
    path: ['batchPauseMaxMin'],
    message: 'Máximo menor que o mínimo',
  })
  .refine(
    (v) => {
      const m = (s: string) => Number(s.split(':')[0]) * 60 + Number(s.split(':')[1]);
      return !HM.test(v.sendWindowStart) || !HM.test(v.sendWindowEnd) || m(v.sendWindowEnd) > m(v.sendWindowStart);
    },
    { path: ['sendWindowEnd'], message: 'A janela precisa terminar depois de começar' },
  )
  .refine((v) => !v.scheduledAt || new Date(v.scheduledAt).getTime() > Date.now(), {
    path: ['scheduledAt'],
    message: 'O agendamento precisa estar no futuro',
  });
export type ConfigValues = z.infer<typeof configSchema>;
