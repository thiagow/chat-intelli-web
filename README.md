# Intelli Chat — Web

**Frontend da Intelli Chat**, uma plataforma de atendimento omnichannel: caixa de entrada unificada para WhatsApp e outros canais, automações visuais, chatbots com fluxo de nós, agentes de IA configuráveis e um CRM leve (pipelines, contatos, segmentos) — tudo em tempo real.

Este repositório é o cliente puro de uma API própria em NestJS ([`chat-intelli-api`](../chat-intelli-api)), consumida via REST e Socket.IO. Não há rotas de API, server actions ou acesso a banco de dados aqui — só interface, estado de cliente e tempo real.

> Interface em português (pt-BR); código e comentários mesclam pt/en, mantendo o padrão do time.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) + [React 19](https://react.dev), build com Turbopack |
| Estilo | [Tailwind CSS 4](https://tailwindcss.com) (PostCSS), dark-first com `next-themes` |
| Estado de servidor | [TanStack Query](https://tanstack.com/query) — cache, invalidação e sincronização com o backend |
| Estado de cliente | [Zustand](https://zustand.docs.pmnd.rs) — sessão, organização ativa, permissões |
| Formulários | [React Hook Form](https://react-hook-form.com) + [Zod](https://zod.dev) |
| Tempo real | [Socket.IO Client](https://socket.io) — singleton com reconexão resiliente |
| Fluxos visuais | [@xyflow/react](https://reactflow.dev) + [Dagre](https://github.com/dagrejs/dagre) (auto-layout) — chatbot e automações |
| Drag & drop | [@dnd-kit](https://dndkit.com) — listas ordenáveis, quadros kanban |
| Gráficos | [Recharts](https://recharts.org) — dashboards e métricas |
| UI primitiva | Componentes autorais no estilo [Catalyst](https://catalyst.tailwindui.com) (não shadcn) |
| Animação | [Framer Motion](https://www.framer.com/motion) |
| Outros | `sonner` (toasts), `lucide-react` (ícones), `axios`, `class-variance-authority` |
| Linguagem | TypeScript (strict) |
| Deploy | Docker multi-stage, output `standalone`, healthcheck próprio |

---

## Funcionalidades

### 📥 Inbox omnichannel
Caixa de entrada unificada em tempo real: lista de conversas, bolhas de mídia (imagem, áudio, vídeo, documento), gravação e transcrição de áudio, atribuição de conversas, popovers de pipeline, indicadores de digitação/status de entrega e ações pendentes de IA — tudo sincronizado via WebSocket sem necessidade de recarregar a página.

### 🤖 Central de IA (AI Agents)
CRUD completo de agentes de IA, catálogo de modelos, base de conhecimento (knowledge base) por organização e roteamento de mensagens entre agentes. Banner global de falhas de ferramentas para visibilidade operacional imediata.

### 🔀 Automações & Chatbot
Construtores visuais de fluxo (nó a nó) sobre React Flow com auto-layout via Dagre — regras de gatilho/ação para automações e árvores de decisão para o chatbot, com nós customizados por tipo.

### 📊 Pipelines (CRM leve)
Board kanban arrastável (`@dnd-kit`) para gestão de oportunidades/etapas de atendimento, com contatos e segmentos de clientes vinculados.

### 📈 Dashboard
Métricas operacionais e de atendimento visualizadas com Recharts, escopadas por organização.

### 👥 Multi-tenant & controle de acesso
Suporte a múltiplas organizações por usuário, com troca de organização ativa, permissões por canal (`ALL` para OWNER/ADMIN, lista explícita para AGENT) aplicadas tanto no cliente quanto no backend, e revogação de acesso em tempo real via evento de socket (`permissions:updated`) — sem necessidade de novo login.

### ⚙️ Configurações
Gestão de canais de comunicação, respostas rápidas, tags, chaves de API, avaliações e preferências da organização.

---

## Arquitetura

```
src/
├── app/                        # App Router — rotas finas, orquestram feature + data
│   ├── (auth)/                 # login, registro
│   └── (dashboard)/            # inbox, pipelines, ai-agents, automations, chatbot,
│                                # contacts, projects, settings, dashboard
├── features/<domínio>/         # onde a lógica de fato mora
│   ├── components/
│   ├── hooks/
│   ├── services/                # funções de API — camada fina sobre o axios
│   └── schemas/                 # validação Zod
├── components/
│   ├── ui/                      # primitivas autorais (sidebar, navbar, dropdown…)
│   └── layout/
├── stores/                       # Zustand (sessão/auth)
├── hooks/                        # hooks globais (ex.: escopo de query por organização)
└── lib/                           # axios client, singleton de socket, query client, utils
```

**Princípio de organização:** rotas são finas e delegam para `features/`; cada domínio de negócio (inbox, automations, chatbot, pipelines, channels, contacts, segments, projects, settings, ai-agents, dashboard, auth) é uma fatia vertical autocontida com seus próprios componentes, hooks e serviços.

### Decisões técnicas que valeram a pena documentar

- **Envelope de resposta da API.** O backend embrulha toda resposta em `{ data, meta }`. Os serviços desembrulham isso de forma consistente (`response.data.data`) para que um erro de contrato vire falha de tipo em vez de um `x.map is not a function` que derruba a árvore React em produção.
- **Chaves de cache com escopo de organização.** Como tudo é multi-tenant via header `x-organization-id`, toda query cujo dado varia por organização carrega o `orgId` na chave do React Query — evitando que a troca de organização sirva cache da tenant anterior.
- **Socket.IO resiliente.** Conexão só se abre com sessão autenticada; reconexão com backoff exponencial e infinita (deploys de ~1 min no backend não devem matar o tempo real); fila de eventos emitidos antes do sinal `ready` do servidor, para não perder um `join:conversation` disparado cedo demais.
- **Interceptors de autenticação centralizados.** Um único cliente axios injeta token e organização ativa, normaliza erros do NestJS para `Error` simples e faz refresh de token single-shot em 401, com fallback seguro para `/login`.

---

## Rodando localmente

```bash
# instalar dependências
yarn install

# configurar variáveis de ambiente
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# desenvolvimento (Turbopack)
yarn dev

# build de produção (standalone, usado pelo Dockerfile)
yarn build
yarn start

# lint
yarn lint
```

Requer a API rodando (`chat-intelli-api`) — veja o README daquele repositório para subir o backend completo (PostgreSQL + Redis).

> ⚠️ `NEXT_PUBLIC_API_URL` é compilada em tempo de build (o Dockerfile a recebe como build ARG): trocar o backend de ambiente exige rebuild da imagem, não apenas reiniciar o container.

## Deploy

Imagem Docker multi-stage (`deps` → `builder` → `runner`), rodando como usuário não-root, com `tini` como init process e healthcheck HTTP embutido. Output do Next.js em modo `standalone` para uma imagem final mínima.

---

## Sobre este projeto

Intelli Chat é uma plataforma full-stack construída para operações de atendimento reais — multi-canal, multi-organização, com automação e IA como parte do fluxo, não como add-on. Este frontend é a peça que dá forma a tudo isso: tempo real que não quebra em deploy, cache que respeita fronteiras de tenant, e construtores visuais que um time não-técnico consegue operar.

---

## O ecossistema Intelli Chat

Este repositório é uma das três peças da plataforma:

### 🖥️ [`chat-intelli-web`](.) — *este repositório*
Frontend em Next.js 16 + React 19. Interface do produto: inbox em tempo real, construtores visuais de chatbot/automações, central de agentes de IA, pipelines e configurações — cliente puro da API, sem lógica de servidor própria.

### ⚙️ [`chat-intelli-api`](../chat-intelli-api)
Backend em NestJS 11, o cérebro da plataforma. Recebe mensagens de WhatsApp/Instagram/Gmail via webhook, processa em pipeline assíncrono orientado a filas (BullMQ + Redis) e roteia para agentes de IA com tool-calling, RAG (pgvector) e roteamento de custo por modelo. Automações rodam sobre um outbox transacional; multi-tenancy e ACL por canal são aplicados via guards em toda a API. Persistência em PostgreSQL via Prisma.

### 🔌 [`chat-intelli-mcp`](../chat-intelli-mcp)
Servidor [Model Context Protocol](https://modelcontextprotocol.io) que expõe os indicadores do dashboard da Intelli Chat como ferramentas somente-leitura para o Claude — permite perguntar diretamente ao assistente pelas métricas de atendimento, sem sair do Claude Code/Desktop. Proxy fino, multi-tenant por sessão, sem estado ou lógica de negócio própria.

```
WhatsApp / Instagram / Gmail
        │
        ▼
┌─────────────────────┐        REST + Socket.IO        ┌──────────────────┐
│  chat-intelli-api    │◀───────────────────────────────▶│  chat-intelli-web │
│  (NestJS, filas, IA) │                                  │  (Next.js, UI)     │
└─────────────────────┘                                  └──────────────────┘
        ▲
        │  API pública (somente leitura)
        │
┌─────────────────────┐
│  chat-intelli-mcp    │
│  (ponte para Claude) │
└─────────────────────┘
```
