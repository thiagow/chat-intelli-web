'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, RotateCcw, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface KnowledgeSource {
  id: string;
  title: string;
  sourceType: 'TEXT' | 'PDF';
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  errorMessage?: string | null;
  chunkCount?: number | null;
  fileName?: string | null;
  createdAt: string;
}

interface KnowledgeManagerProps {
  agentId?: string;
}

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  READY: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const STATUS_LABELS = {
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  READY: 'Pronto',
  FAILED: 'Erro',
};

async function listKnowledge(agentId?: string) {
  const params = agentId ? `?agentId=${agentId}` : '';
  const { data } = await api.get(`/knowledge${params}`);
  return data as KnowledgeSource[];
}

async function createKnowledge(payload: { title: string; content: string; agentId?: string }) {
  const { data } = await api.post('/knowledge', payload);
  return data;
}

async function uploadKnowledge(formData: FormData) {
  const { data } = await api.post('/knowledge/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

async function deleteKnowledge(id: string) {
  await api.delete(`/knowledge/${id}`);
}

async function reindexKnowledge(id: string) {
  const { data } = await api.post(`/knowledge/${id}/reindex`);
  return data;
}

export function KnowledgeManager({ agentId }: KnowledgeManagerProps) {
  const qc = useQueryClient();
  const { data: sources, isLoading, refetch } = useQuery({
    queryKey: ['knowledge', agentId],
    queryFn: () => listKnowledge(agentId),
  });

  const [showTextDialog, setShowTextDialog] = useState(false);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textLoading, setTextLoading] = useState(false);

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const { mutate: handleDeleteKnowledge, isPending: deleting } = useMutation({
    mutationFn: deleteKnowledge,
    onSuccess: () => {
      toast.success('Documento removido');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Erro ao remover');
    },
  });

  const { mutate: handleReindex, isPending: reindexing } = useMutation({
    mutationFn: reindexKnowledge,
    onSuccess: () => {
      toast.success('Reindexação iniciada');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Erro ao reindexar');
    },
  });

  const handleAddText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textTitle.trim() || !textContent.trim()) {
      toast.error('Título e conteúdo são obrigatórios');
      return;
    }

    setTextLoading(true);
    try {
      await createKnowledge({
        title: textTitle.trim(),
        content: textContent.trim(),
        agentId,
      });
      toast.success('Documento de texto adicionado');
      setTextTitle('');
      setTextContent('');
      setShowTextDialog(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao adicionar');
    } finally {
      setTextLoading(false);
    }
  };

  const handleAddPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !uploadFile) {
      toast.error('Título e arquivo são obrigatórios');
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', uploadTitle.trim());
      formData.append('file', uploadFile);
      if (agentId) formData.append('agentId', agentId);

      await uploadKnowledge(formData);
      toast.success('PDF adicionado');
      setUploadTitle('');
      setUploadFile(null);
      setShowUploadDialog(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao fazer upload');
    } finally {
      setUploadLoading(false);
    }
  };

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />;
  }

  return (
    <div className="space-y-4">
      {/* Header with buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowTextDialog(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Adicionar texto
        </button>
        <button
          onClick={() => setShowUploadDialog(true)}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          <Plus className="h-4 w-4" />
          Upload PDF
        </button>
      </div>

      {/* Sources list */}
      {!sources || sources.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500">
            {agentId ? 'Nenhum documento para este agente' : 'Nenhum documento de conhecimento'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {source.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[source.status]}`}>
                    {STATUS_LABELS[source.status]}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {source.sourceType === 'TEXT' ? 'Texto' : `PDF (${source.fileName})`}
                  </span>
                  {source.chunkCount !== null && source.chunkCount !== undefined && (
                    <span className="text-xs text-zinc-500">
                      {source.chunkCount} chunk{source.chunkCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {source.status === 'FAILED' && source.errorMessage && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {source.errorMessage}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {source.status === 'FAILED' && (
                  <button
                    onClick={() => handleReindex(source.id)}
                    disabled={reindexing}
                    title="Reindexar"
                    className="rounded p-1 text-zinc-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 dark:hover:bg-blue-900"
                  >
                    {reindexing ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => handleDeleteKnowledge(source.id)}
                  disabled={deleting}
                  title="Remover"
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900"
                >
                  {deleting ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Text dialog */}
      {showTextDialog && (
        <TextKnowledgeDialog
          onClose={() => setShowTextDialog(false)}
          onSubmit={handleAddText}
          loading={textLoading}
          title={textTitle}
          onTitleChange={setTextTitle}
          content={textContent}
          onContentChange={setTextContent}
        />
      )}

      {/* Upload dialog */}
      {showUploadDialog && (
        <UploadKnowledgeDialog
          onClose={() => setShowUploadDialog(false)}
          onSubmit={handleAddPdf}
          loading={uploadLoading}
          title={uploadTitle}
          onTitleChange={setUploadTitle}
          file={uploadFile}
          onFileChange={setUploadFile}
        />
      )}
    </div>
  );
}

function TextKnowledgeDialog({
  onClose,
  onSubmit,
  loading,
  title,
  onTitleChange,
  content,
  onContentChange,
}: {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  loading: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  content: string;
  onContentChange: (v: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Adicionar conhecimento de texto
        </h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="ex: Políticas de Garantia"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Conteúdo
            </label>
            <textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Cole o texto aqui..."
              rows={8}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UploadKnowledgeDialog({
  onClose,
  onSubmit,
  loading,
  title,
  onTitleChange,
  file,
  onFileChange,
}: {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  loading: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  file: File | null;
  onFileChange: (f: File | null) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Upload de PDF
        </h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="ex: Manual do Produto"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Arquivo PDF (máx 10MB)
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => onFileChange(e.target.files?.[0] || null)}
              className="mt-1 w-full text-sm file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground file:cursor-pointer hover:file:bg-primary/90"
            />
            {file && (
              <p className="mt-2 text-xs text-zinc-500">
                Arquivo selecionado: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Fazendo upload...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
