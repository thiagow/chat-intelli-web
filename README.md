# Intelli Chat — Web

**Frontend of Intelli Chat**, an omnichannel customer-service platform: a unified inbox for WhatsApp and other channels, visual automation builders, node-based chatbot flows, configurable AI agents, and a lightweight CRM (pipelines, contacts, segments) — all in real time.

This repository is a pure client of a separate NestJS API ([`chat-intelli-api`](../chat-intelli-api)), consumed over REST and Socket.IO. There are no API routes, server actions, or database access here — just UI, client state, and realtime.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) + [React 19](https://react.dev), built with Turbopack |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) (PostCSS), dark-first with `next-themes` |
| Server state | [TanStack Query](https://tanstack.com/query) — caching, invalidation, and sync with the backend |
| Client state | [Zustand](https://zustand.docs.pmnd.rs) — session, active organization, permissions |
| Forms | [React Hook Form](https://react-hook-form.com) + [Zod](https://zod.dev) |
| Realtime | [Socket.IO Client](https://socket.io) — a resilient singleton with automatic recovery |
| Visual flows | [@xyflow/react](https://reactflow.dev) + [Dagre](https://github.com/dagrejs/dagre) (auto-layout) — chatbot and automation builders |
| Drag & drop | [@dnd-kit](https://dndkit.com) — sortable lists, kanban boards |
| Charts | [Recharts](https://recharts.org) — dashboards and metrics |
| UI primitives | Hand-rolled components in a [Catalyst](https://catalyst.tailwindui.com)-style (not shadcn) |
| Animation | [Framer Motion](https://www.framer.com/motion) |
| Other | `sonner` (toasts), `lucide-react` (icons), `axios`, `class-variance-authority` |
| Language | TypeScript (strict) |
| Deploy | Multi-stage Docker, `standalone` output, built-in healthcheck |

---

## Features

### 📥 Omnichannel inbox
Unified, real-time inbox: conversation list, media bubbles (image, audio, video, document), audio recording and transcription, conversation assignment, pipeline popovers, typing/delivery-status indicators, and pending AI actions — all synced over WebSocket with no page reload.

### 🤖 AI agents ("Central de IA")
Full CRUD for AI agents, a model catalog, an organization-scoped knowledge base, and message routing between agents. A global tool-failure banner surfaces operational issues immediately.

### 🔀 Automations & chatbot builders
Visual, node-based flow builders on React Flow with Dagre auto-layout — trigger/action rules for automations and decision trees for the chatbot, each with custom node types.

### 📊 Pipelines (lightweight CRM)
Draggable kanban board (`@dnd-kit`) for managing service/opportunity stages, linked to contacts and customer segments.

### 📈 Dashboard
Operational and service metrics visualized with Recharts, scoped per organization.

### 👥 Multi-tenancy & access control
Multiple organizations per user with active-org switching, per-channel permissions (`ALL` for OWNER/ADMIN, an explicit list for AGENT) enforced on both client and backend, and real-time access revocation via a socket event (`permissions:updated`) — no re-login required.

### ⚙️ Settings
Management of communication channels, quick replies, tags, API keys, ratings, and organization preferences.

---

## Architecture

```
src/
├── app/                        # App Router — thin routes, wire feature + data together
│   ├── (auth)/                 # login, register
│   └── (dashboard)/            # inbox, pipelines, ai-agents, automations, chatbot,
│                                # contacts, projects, settings, dashboard
├── features/<domain>/          # where the actual logic lives
│   ├── components/
│   ├── hooks/
│   ├── services/                # API functions — a thin layer over axios
│   └── schemas/                 # Zod validation
├── components/
│   ├── ui/                      # hand-rolled primitives (sidebar, navbar, dropdown…)
│   └── layout/
├── stores/                       # Zustand (session/auth)
├── hooks/                        # global hooks (e.g. per-organization query scoping)
└── lib/                           # axios client, socket singleton, query client, utils
```

**Organizing principle:** routes stay thin and delegate to `features/`; each business domain (inbox, automations, chatbot, pipelines, channels, contacts, segments, projects, settings, ai-agents, dashboard, auth) is a self-contained vertical slice with its own components, hooks, and services.

### Technical decisions worth documenting

- **API response envelope.** The backend wraps every response in `{ data, meta }`. Services consistently unwrap it (`response.data.data`) so a contract mismatch surfaces as a type error instead of an `x.map is not a function` that crashes the React tree in production.
- **Organization-scoped cache keys.** Since everything is multi-tenant via the `x-organization-id` header, every query whose data varies per organization carries `orgId` in its React Query key — preventing an organization switch from serving the previous tenant's cache.
- **Resilient Socket.IO.** The connection only opens with an authenticated session; reconnection uses exponential backoff and never gives up (a ~1-minute backend deploy shouldn't kill realtime); events emitted before the server's `ready` signal are queued instead of dropped.
- **Centralized auth interceptors.** A single axios client injects the token and active organization, normalizes NestJS errors into plain `Error` objects, and performs a single-shot token refresh on 401 with a safe fallback to `/login`.

---

## Running locally

```bash
# install dependencies
yarn install

# configure environment variables
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# development (Turbopack)
yarn dev

# production build (standalone, used by the Dockerfile)
yarn build
yarn start

# lint
yarn lint
```

Requires the API to be running (`chat-intelli-api`) — see that repository's README to spin up the full backend (PostgreSQL + Redis).

> ⚠️ `NEXT_PUBLIC_API_URL` is baked in at build time (the Dockerfile receives it as a build ARG): pointing to a different backend environment requires rebuilding the image, not just restarting the container.

## Deploy

Multi-stage Docker image (`deps` → `builder` → `runner`), running as a non-root user, with `tini` as the init process and a built-in HTTP healthcheck. Next.js `standalone` output keeps the final image minimal.

---

## About this project

Intelli Chat is a full-stack platform built for real customer-service operations — multi-channel, multi-organization, with automation and AI as part of the flow, not a bolt-on. This frontend is the piece that gives all of that shape: realtime that survives deploys, a cache that respects tenant boundaries, and visual builders a non-technical team can actually operate.

---

## The Intelli Chat ecosystem

This repository is one of three pieces that make up the platform:

### 🖥️ [`chat-intelli-web`](.) — *this repository*
Frontend built with Next.js 16 + React 19. The product's interface: realtime inbox, visual chatbot/automation builders, an AI agents control center, pipelines, and settings — a pure API client with no server-side logic of its own.

### ⚙️ [`chat-intelli-api`](../chat-intelli-api)
Backend built with NestJS 11, the platform's brain. Receives WhatsApp/Instagram/Gmail messages via webhook, processes them through an async, queue-driven pipeline (BullMQ + Redis), and routes them to AI agents with tool-calling, RAG (pgvector), and per-model cost routing. Automations run on a transactional outbox; multi-tenancy and per-channel ACLs are enforced via guards throughout the API. Persistence in PostgreSQL via Prisma.

### 🔌 [`chat-intelli-mcp`](../chat-intelli-mcp)
A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes Intelli Chat's dashboard indicators as read-only tools for Claude — ask the assistant directly about service metrics without leaving Claude Code/Desktop. A thin, per-session multi-tenant proxy with no state or business logic of its own.

```
WhatsApp / Instagram / Gmail
        │
        ▼
┌─────────────────────┐        REST + Socket.IO        ┌──────────────────┐
│  chat-intelli-api    │◀───────────────────────────────▶│  chat-intelli-web │
│  (NestJS, queues, AI) │                                 │  (Next.js, UI)     │
└─────────────────────┘                                  └──────────────────┘
        ▲
        │  Public API (read-only)
        │
┌─────────────────────┐
│  chat-intelli-mcp    │
│  (bridge to Claude)  │
└─────────────────────┘
```
