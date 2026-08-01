'use client';

import { BookOpen } from 'lucide-react';
import { KnowledgeManager } from '@/features/ai-agents/components/knowledge-manager';

export default function SettingsKnowledgePage() {
  return (
    <div>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <BookOpen className="h-5 w-5 text-primary" />
          Base de Conhecimento
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Documentos disponíveis para todos os agentes da organização
        </p>
      </div>

      <div className="mt-6">
        <KnowledgeManager />
      </div>

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Dica:</strong> Documentos adicionados aqui estarão disponíveis para todos os agentes da organização.
          Você também pode adicionar documentos específicos para um agente individual ao editar o agente.
        </p>
      </div>
    </div>
  );
}
