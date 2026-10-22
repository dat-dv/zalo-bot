---
metadata:
  agent-artifact:
    id: project-overview
    type: documentation
    depends_on:
      - .claude/rules/plugins.md
      - .agents/knowledge/README.md
      - .agents/knowledge/global/README.md
      - .agents/knowledge/modules/README.md
      - apps/api/src/app.module.ts
      - apps/api/src/google/google-auth.service.ts
      - apps/web/app/(private)
      - packages/contracts/src/index.ts
---

# Project Overview

Owner: Core Engineering Team
Status: active

## Purpose

Zalobot is an intelligent 24/7 personal and group AI assistant operating natively inside Zalo via the official Zalo Bot webhook and personal ZCA (`zca-js`) clients. It connects personal financial management (income, expense, places, debt allocation), Google Workspace productivity (Calendar, Tasks, Drive, Photos), automated reminders, and multi-tenant administrative controls with a responsive Next.js Web Dashboard.

## Scope

- **Core Capabilities**:
  - **Natural Language & Function Calling**: `LlmService` (`apps/api/src/llm`) dispatches to the provider selected by `LLM_PROVIDER` (`gemini` default, `openai`, `qwen`/`ollama`) with the tool catalog `ZALO_TOOL_DEFINITIONS` for expense recording, debt tracking, reminders, places, and Google Workspace operations.
  - **Interactive Confirmation & Message Recall**: 3-digit verification codes (`yes <code>`, `cancel <code>`, `edit <code>`), reaction approvals (❤️ / 😡), 5-minute timeout, and automatic message recall (`undoMessage` / `zca.undo`) to keep conversation feeds clean.
  - **Google Workspace per User & Channel**: Multi-tenant OAuth2 token isolation for Google Calendar and Google Tasks. Per-channel Google Drive storage partitions (`zalobot/<channelId>/<category>`) and Google Photos albums for bills, images, videos, files, and audio, with self-service `@bot share <email>` access grants.
  - **Shared Ledger**: The system has one finance store with no per-user scoping (finance tables have no `user_id`); every user sees all finance data, and each transaction records its creator and source chat for display (see global/finance-domain.md).
  - **Finance & Debt Allocation**: Cashflow ledger with place binding (`placeId`), candidate debt query and transaction-to-debt allocations, debt contact directory, debt payments, and combine (merge) of places, contacts, and debts.
  - **Web Dashboard**: 1-click exchange-token login, full-width responsive data tables, analytics charts, admin user management, and ZCA thread configuration.

- **Dashboard Pages** (`apps/web/app/(private)/`, constants in `APP_ROUTES`):
  - `/` and `/dashboard`: overview (`DashboardHomeScreen`).
  - `/transactions`: income/expense ledger; `/expenses` and `/income` redirect to `/transactions?type=expense|income`.
  - `/debts`, `/analytics`, `/calendar`, `/tasks`, `/reminders`, `/contacts`, `/places`, `/settings`.
  - `/zca`: "Zalo & Users" — ZCA login, listened threads, and admin user management; table search/filter/page live in the query string.
  - `/zca/thread?id=<threadId>`: per-thread bot configuration page (query param because the static export has no dynamic segments).
  - Public pages outside the private group: `/about`, `/privacy`, `/terms`.

- **Target Audience**:
  - Individual users and groups seeking automated financial record-keeping, debt tracking, and schedule management within Zalo.
  - System administrators managing multi-tenant authorization, ZCA personal account sessions, and Google Workspace connections.

- **Key Integrations**:
  - **Zalo**: Official Zalo Bot Platform webhooks and ZCA personal account WebSocket via `zca-js`.
  - **Google Workspace**: Google Calendar API, Google Tasks API, Google Drive API (`drive.file`), Google Photos Library API (`photoslibrary.appendonly`).
  - **AI / LLMs**: Google Gemini, OpenAI (or any OpenAI-compatible endpoint), Qwen via Ollama-compatible endpoint. Local Tesseract OCR (`vie+eng`) for receipt images.
  - **Infrastructure**: PostgreSQL 16 (TypeORM), Redis (caching, ZCA sessions, pending confirmation state, rate limits).

## Project Structure & Architecture

See the [Global Architecture & Rules](global/README.md) and [Feature Modules](modules/README.md) for complete technical design, system boundaries, and data flows.

## Key Terminology

- **Pending Action**: A sensitive system mutation temporarily queued in memory and Redis with a 3-digit code and a 5-minute TTL.
- **Message Recall (Undo)**: Immediate recall of intermediate confirmation prompt messages via ZCA API once an action is confirmed, cancelled, timed out, or edited.
- **ZCA Thread / Channel**: A 1-1 or group chat within Zalo, identified by its immutable `channelId`.
- **Channel Drive Partition**: An isolated Google Drive folder dedicated to a specific ZCA channel (`zalobot/<channelId>/<category>`).
