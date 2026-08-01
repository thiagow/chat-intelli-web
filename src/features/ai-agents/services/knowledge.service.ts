import { api } from '@/lib/api';

export interface KnowledgeSource {
  id: string;
  organizationId: string;
  agentId?: string | null;
  title: string;
  sourceType: 'TEXT' | 'PDF';
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  errorMessage?: string | null;
  chunkCount?: number | null;
  fileName?: string | null;
  fileSize?: number | null;
  createdAt: string;
  updatedAt: string;
}

class KnowledgeService {
  async list(agentId?: string): Promise<KnowledgeSource[]> {
    const params = agentId ? `?agentId=${agentId}` : '';
    const { data } = await api.get(`/knowledge${params}`);
    return data.data ?? data;
  }

  async get(id: string): Promise<KnowledgeSource> {
    const { data } = await api.get(`/knowledge/${id}`);
    return data.data ?? data;
  }

  async createText(payload: {
    title: string;
    content: string;
    agentId?: string;
  }): Promise<KnowledgeSource> {
    const { data } = await api.post('/knowledge', payload);
    return data.data ?? data;
  }

  async uploadPdf(payload: {
    title: string;
    file: File;
    agentId?: string;
  }): Promise<KnowledgeSource> {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('file', payload.file);
    if (payload.agentId) {
      formData.append('agentId', payload.agentId);
    }

    const { data } = await api.post('/knowledge/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data ?? data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/knowledge/${id}`);
  }

  async reindex(id: string): Promise<KnowledgeSource> {
    const { data } = await api.post(`/knowledge/${id}/reindex`);
    return data.data ?? data;
  }
}

export const knowledgeService = new KnowledgeService();
