# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`chat-intelli-web` is the Next.js 16 (App Router, React 19, Tailwind v4) frontend for **Intelli Chat**, an omnichannel customer-service platform. It is a pure client of a separate NestJS backend (`chat-intelli-api`) reached over REST + Socket.IO — there are no API routes, no server actions, and no database access here. UI language is Portuguese (pt-BR); code and comments are mixed pt/en.

## Commands

```bash
yarn dev      # next dev --turbopack
yarn build    # next build (output: 'standalone', used by the Dockerfile)
yarn start    # serve the production build
yarn lint     # next lint
```

There is no test suite and no test runner configured.

Requires `NEXT_PUBLIC_API_URL` (see `.env.example`), e.g. `http://localhost:3001/api/v1`. It is baked in at build time — the Dockerfile passes it as a build ARG, so changing the backend URL requires rebuilding the image, not just restarting it.

## Architecture

### Layout: routes are thin, features hold the logic

- `src/app/(auth)/…`, `src/app/(dashboard)/…` — route groups. `(dashboard)/layout.tsx` is the auth gate: it reads `access_token` from localStorage, calls `authService.getMe()`, hydrates the auth store, and redirects to `/login` on failure. Page files mostly wire React Query to feature components.
- `src/features/<domain>/{components,hooks,services,schemas,utils}` — where the actual work lives. One folder per domain (inbox, ai-agents, automations, chatbot, pipelines, channels, contacts, segments, projects, settings, inbox-views, dashboard, auth).
- `src/components/ui` — hand-rolled Catalyst-style primitives (sidebar, navbar, dropdown, avatar). Not shadcn; there is no `components.json` and no generator. Add primitives by hand, matching the existing `cn()` + zinc/dark-variant class idiom.
- `src/lib` — `api.ts` (axios), `socket.ts` (Socket.IO singleton), `query-client.ts`, `utils.ts` (`cn`).
- Path alias `@/*` → `./src/*`.

### The API response envelope — read this before writing any service

The backend wraps **every** response in `{ data: T, meta: { timestamp } }` via a global `ResponseInterceptor`. Service functions must unwrap it:

```ts
const { data } = await api.get('/tags');
return data.data;              // or: return data.data ?? data;
```

Forgetting this is not a type error — it produces a runtime `x.map is not a function` that unmounts the whole React tree with no error boundary to catch it (commit `122cbf6` fixed exactly this in the knowledge/organization calls). Paginated endpoints add `meta.total`/`meta.page` alongside.

Services are plain object literals of async functions in `src/features/<domain>/services/*.service.ts` — no classes, no hooks inside. They export the DTO interfaces they use. Components call them through React Query.

### Auth, tokens, and the organization header

`src/lib/api.ts` is the only axios instance. Its request interceptor attaches, from localStorage:
- `Authorization: Bearer <access_token>`
- `x-organization-id: <active_org_id>`

The response interceptor performs a single-shot refresh on 401 (`_retry` flag) against `/auth/refresh`, and on refresh failure clears tokens and hard-navigates to `/login`. It also normalizes errors: rejections are always a plain `Error` whose message is `response.data.message` (unwrapping NestJS's array-of-messages form). So `catch (e) { e.message }` is safe everywhere; there is no axios error shape to inspect downstream.

`src/stores/auth-store.ts` (Zustand, the only store) holds `user`, `organizations`, and `activeOrgId`. localStorage is the source of truth across reloads; the store mirrors it. Each org carries `accessibleChannelIds: 'ALL' | string[]` — `'ALL'` for OWNER/ADMIN, an explicit deny-by-default list for AGENT. Client-side channel filtering keys off this; the backend enforces it independently.

### Multi-tenancy and React Query keys

Everything is org-scoped through the `x-organization-id` header, so **any query whose data differs per organization must include `orgId` in its key** — get it from `useOrgId()` (`src/hooks/use-org-query-key.ts`). Without it, switching organizations serves the previous tenant's cache. Existing keys are inconsistent about this (`['dashboard-overview', orgId]` and `['chatbot-flows', orgId]` do it; `['pipelines']` and `['automations']` do not); follow the scoped form for new code. Defaults: `staleTime` 30s, `retry` 1, no refetch on window focus.

### Realtime

`src/lib/socket.ts` is a module-level Socket.IO singleton connecting to `NEXT_PUBLIC_API_URL` minus the `/api/v1` suffix, authenticating with the same token + `active_org_id` via the `auth` callback. Its behavior is deliberate and heavily commented in Portuguese — read those comments before changing anything:

- `autoConnect` is `!!token`; a logged-out socket is born closed and `getSocket()` opens it once a *different* token appears (that is what makes realtime work after a client-side `/login → /inbox` navigation without an F5).
- When the gateway rejects a stale token it calls `disconnect()` server-side, which socket.io-client reports as `io server disconnect` and **never** auto-retries. `recoverFromServerDisconnect()` handles that case with exponential backoff + a token refresh. REST keeps working through the axios interceptor, so without this the app looks alive while silently receiving no events.
- `reconnectionAttempts: Infinity` — a finite count means a one-minute backend deploy kills realtime until reload.

`useSocket()` (`src/features/inbox/hooks/use-socket.ts`) is the consumer API. The backend emits `ready` at the end of its connection handler, once role and channel IDs are loaded; `join:conversation` emitted before `ready` is silently dropped, so the hook queues the join and replays it (and re-joins the tracked room on every reconnect). `onReconnect(fn)` fires on every `ready` after the first — use it to refetch anything that could have gone stale while offline.

Server events in use: `message:new`, `message:status`, `message:revoked`, `conversation:updated`, `conversation:read`, `conversation:unread`, `conversation:imported`, `contact:avatar`, `ai:run:start`, `ai:run:end`, `automation:run`, `permissions:updated`, `ready`. `permissions:updated` is handled globally by `usePermissionsSync()` in the dashboard layout: it patches the auth store and invalidates `channels` / `conversations` / `conversation-counts` so revoked access takes effect without a relogin.

### Feature notes

- **Inbox** is the heart of the app — `chat-panel.tsx` (~1300 lines) plus conversation list, media bubbles, audio recording, pending AI actions (`src/features/inbox/pending-actions/`), pipeline and assignment popovers. Socket events and React Query cache updates are interleaved here; when adding an event handler, invalidate or patch the matching `['messages', conversationId]` / `['conversations']` keys.
- **Chatbot** and **automations** are visual builders on `@xyflow/react` + `@dagrejs/dagre` (auto-layout). Node types live in `src/features/chatbot/components/nodes/`.
- **AI agents** ("Central de IA" in the UI, `jarvis` in some filenames) covers agent CRUD, the model catalog, the knowledge base, and a tool-failure banner mounted globally in the dashboard layout.
- Forms use react-hook-form + zod (`@hookform/resolvers`); toasts use `sonner`; theming uses `next-themes` with `attribute="class"`, so every component needs `dark:` variants.
