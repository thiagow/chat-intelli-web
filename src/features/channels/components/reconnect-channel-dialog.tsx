'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, QrCode, Smartphone, X } from 'lucide-react';
import { channelsService, type Channel, type ConnectChannelResult } from '../services/channels.service';

interface ReconnectChannelDialogProps {
  channel: Channel | null;
  onClose: () => void;
  onConnected: () => void;
}

const POLL_MS = 3000;
// O QR da UaZAPI expira em ~1–2 min; pedir um novo antes disso evita o usuário escanear um código morto.
const QR_REFRESH_MS = 55_000;

function qrSrc(qr: string) {
  return qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
}

export function ReconnectChannelDialog({ channel, onClose, onConnected }: ReconnectChannelDialogProps) {
  const [mode, setMode] = useState<'qr' | 'code'>('qr');
  const [phone, setPhone] = useState('');
  const [session, setSession] = useState<ConnectChannelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const aliveRef = useRef(true);
  const onConnectedRef = useRef(onConnected);
  useEffect(() => {
    onConnectedRef.current = onConnected;
  });

  const channelId = channel?.id;

  const request = useCallback(
    async (withPhone?: string) => {
      if (!channelId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await channelsService.connect(channelId, withPhone);
        if (!aliveRef.current) return;
        if (res.alreadyConnected) {
          setConnected(true);
          return;
        }
        setSession(res);
      } catch (err) {
        if (aliveRef.current) setError(err instanceof Error ? err.message : 'Não foi possível gerar o QR code');
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    },
    [channelId],
  );

  // Reset + primeiro QR ao abrir.
  useEffect(() => {
    aliveRef.current = true;
    if (!channelId) return;
    setMode('qr');
    setPhone('');
    setSession(null);
    setConnected(false);
    setError(null);
    void request();
    return () => {
      aliveRef.current = false;
    };
  }, [channelId, request]);

  // Polling do estado real da instância até conectar.
  useEffect(() => {
    if (!channelId || connected) return;
    const t = setInterval(async () => {
      try {
        const r = await channelsService.testConnection(channelId);
        if (aliveRef.current && r.success) {
          setConnected(true);
          toast.success('WhatsApp conectado');
          onConnectedRef.current();
        }
      } catch {
        /* próximo ciclo tenta de novo */
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [channelId, connected]);

  // Renova o QR automaticamente enquanto o modo QR estiver ativo.
  useEffect(() => {
    if (!channelId || connected || mode !== 'qr' || !session?.qrcode) return;
    const t = setTimeout(() => void request(), QR_REFRESH_MS);
    return () => clearTimeout(t);
  }, [channelId, connected, mode, session, request]);

  if (!channel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reconectar WhatsApp"
        className="relative z-50 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Reconectar WhatsApp</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{channel.name}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {connected ? (
          <div className="mt-8 flex flex-col items-center gap-3 pb-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">WhatsApp conectado</p>
            <button
              onClick={onClose}
              className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
            >
              Concluir
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800">
              {(
                [
                  ['qr', 'QR code', QrCode],
                  ['code', 'Código', Smartphone],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => {
                    setMode(key);
                    setError(null);
                    if (key === 'qr') void request();
                    else setSession(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors ${
                    mode === key
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>

            <div className="mt-5 flex min-h-64 flex-col items-center justify-center">
              {mode === 'qr' ? (
                loading && !session?.qrcode ? (
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                ) : session?.qrcode ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrSrc(session.qrcode)}
                    alt="QR code para conectar o WhatsApp"
                    className="h-60 w-60 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700"
                  />
                ) : (
                  !error && <p className="text-sm text-zinc-500">Nenhum QR disponível. Gere um novo.</p>
                )
              ) : session?.pairingCode ? (
                <div className="text-center">
                  <p className="font-mono text-3xl font-semibold tracking-widest text-zinc-900 dark:text-zinc-100">
                    {session.pairingCode}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    No WhatsApp: Aparelhos conectados → Conectar com número de telefone → digite o código.
                  </p>
                </div>
              ) : (
                <div className="w-full space-y-3">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Número do WhatsApp (com DDD)
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="62999999999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <button
                    disabled={loading || phone.replace(/\D/g, '').length < 10}
                    onClick={() => {
                      const d = phone.replace(/\D/g, '');
                      void request(d.startsWith('55') ? d : `55${d}`);
                    }}
                    className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                  >
                    {loading ? 'Gerando…' : 'Gerar código'}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Aguardando conexão…
              </span>
              {mode === 'qr' && (
                <button
                  disabled={loading}
                  onClick={() => void request()}
                  className="font-medium text-zinc-700 hover:underline disabled:opacity-50 dark:text-zinc-300"
                >
                  Gerar novo QR
                </button>
              )}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
              No celular: WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
