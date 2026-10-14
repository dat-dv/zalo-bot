---
metadata:
  agent-artifact:
    id: project-overview
    type: documentation
    depends_on:
      - .agents/rules/plugins.md
      - .agents/knowledge/README.md
      - .agents/knowledge/global/README.md
      - .agents/knowledge/modules/README.md
      - .agents/system-explain/maintainer-guide.md
---

# Project Overview

Owner: Core Engineering Team
Status: active

## Purpose

Zalobot is an intelligent 24/7 personal and group AI assistant operating natively inside Zalo via official Webhook and personal ZCA (`zca-js`) clients. It connects personal financial management (income, expense, places, debt allocation), Google Workspace productivity (Calendar, Tasks, Drive), automated reminders, and multi-tenant administrative controls with a responsive Next.js Web Dashboard.

## Scope

- **Core Capabilities**:
  - **Natural Language & Function Calling**: Multi-provider LLM parsing (Gemini, OpenAI, Qwen) for expense recording, debt tracking, reminders, and Google Workspace operations.
  - **Interactive Confirmation & Message Recall**: 3-digit verification codes (`yes <code>`, `cancel <code>`, `edit <code>`), reaction approvals (❤️ / 😡), 5-minute timeout, and automatic message recall (`undoMessage` / `zca.undo`) to keep conversation feeds clean.
  - **Google Workspace per User & Channel**: Multi-tenant OAuth2 token isolation for Google Calendar (multi-bell alarms) and Google Tasks. Per-channel Google Drive storage partitions (`zalobot/<channelId>/<category>`) for images, videos, files, and audio, with self-service `@bot share <email>` access grants.
  - **Finance & Debt Allocation**: Cashflow ledger with place binding (`placeId`), candidate debt query and atomic transaction-to-debt funding allocations, debt contact directory, and wallet reconciliation.
  - **Web Dashboard**: 1-click token exchange login, full-width responsive data tables, analytics charts, user directory management, and ZCA thread configuration.

- **Target Audience**:
  - Individual users and groups seeking automated financial record-keeping, debt tracking, and schedule management within Zalo.
  - System administrators managing multi-tenant authorization, ZCA personal account sessions, and Google Workspace connections.

- **Key Integrations**:
  - **Zalo**: Official Zalo Bot Platform Webhooks and ZCA personal account WebSocket via `zca-js`.
  - **Google Workspace**: Google Calendar API, Google Tasks API, Google Drive API (`drive.file`), Google Photos API.
  - **AI / LLMs**: Google Gemini, OpenAI, Qwen / local Ollama.
  - **Infrastructure**: PostgreSQL 16 (TypeORM), Redis (caching, ZCA sessions, pending confirmation state, rate limits).

## Project Structure & Architecture

See the [Global Architecture & Rules](global/README.md) and [Feature Modules](modules/README.md) for complete technical design, system boundaries, and data flows.

## Key Terminology

- **Pending Action**: A sensitive system mutation temporarily queued in memory and Redis with a 3-digit code and a 5-minute TTL.
- **Message Recall (Undo)**: Immediate recall of intermediate confirmation prompt messages via ZCA API once an action is confirmed, cancelled, timed out, or edited.
- **ZCA Thread / Channel**: A 1-1 or group chat within Zalo, identified by its immutable `channelId`.
- **Channel Drive Partition**: An isolated Google Drive folder dedicated to a specific ZCA channel (`zalobot/<channelId>/<category>`).

