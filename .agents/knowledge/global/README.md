# Global System Knowledge

This directory contains system-wide business policies, cross-cutting architecture, and infrastructure standards.

## Global Topics

- [Monorepo Architecture](monorepo-architecture.md): npm workspaces, app boundaries, environment scoping, and build order.
- [Environment Guard](environment-guard.md): fail-fast configuration contract for API startup and dashboard builds.
- [Type Safety & Zero-Any Invariant](type-safety.md): System-wide zero-any policy and type safety requirements.
- [Route & Path Constants Architecture](route-constants.md): Centralized route and endpoint registry invariants and zero-hardcoding enforcement.
- [Local-First AI Usage](local-first-ai-usage.md): Token-conserving local extraction and minimal AI interpretation policy.
- [Dashboard Session and Pages](dashboard-session.md): One-time Zalo exchange, sign-in code for the installed app, access/refresh policy, contacts isolation, and web views.
- [Installable Web App (PWA)](pwa.md): Manifest, hand-written service worker caching rules, update handoff, offline shell, install entry, and nginx cache headers.
- [Task Commands](google-tasks.md): `CREATE_TASK` tool, duplicate check, and `/tasks` listing.
- [Public Google OAuth Verification](google-oauth-public-verification.md): Minimal scope contract, public policy pages, and production review requirements.
- [Zalo Response Layout](zalo-response-layout.md): Plain-text replies (LLM markdown stripped at send), compact response hierarchy, pending-action codes, reactions, and message recall.
- [Zalo Command Intake](zalo-command-intake.md): ZCA intake, guards, cooldown, and fast-path commands.
- [Receipt Image Analysis](receipt-image-analysis.md): In-memory image analysis and confirmation-gated finance proposals.
- [Web UI Direction](web-ui-direction.md): Shared data-dense dashboard, accessibility requirements, and global client UI state (Zustand stores).
- [Backend CRUD API](backend-crud-api.md): Ownership-safe REST operations for finance, reminders, users, ZCA, Calendar, and Tasks.
- [Backend Exception Filter](backend-exception-filter.md): Global NestJS exception filter mapping TypeORM/HttpException into uniform error payloads.
- [Finance Domain](finance-domain.md): Backend finance rules — single shared finance store (no per-user scoping), places, debts, payments, allocations, categories, analytics, and LLM tools.
- [Financial Report Contracts](financial-report-contracts.md): Report/analytics response contracts consumed by the dashboard.
- [LLM Providers](llm-providers.md): `LlmService`, provider selection via `LLM_PROVIDER`, and Zalo tool definitions.
- [Backend Runtime Services](backend-runtime-services.md): Health check, Redis, OCR, media storage, background jobs (BullMQ reminder queues), audit, Google resource links.
- [Internationalization](i18n.md): Supported locales, user preference persistence, and cross-channel formatting rules.

## Consumer Project Adoption

Base Agents is a reusable framework, not an application template. A consumer project owns its domain model, application modules, data contracts, and runtime verification.

Before using Base Agents in a consumer project:

1. Install the base and select only plugins that match the project's stack and needs.
2. Replace project-overview placeholders with the project's purpose, users, domain terms, integrations, and architecture boundaries.
3. Create matching English knowledge and Vietnamese developer guides for every project-owned feature module.
4. Follow route and authority boundaries: research for discovery, investigate for diagnosis, and implement for approved changes.
5. Run `npm run agent-system:validate`, `npm run agent-system:test`, and `npm run agent-system:typecheck` after Base Agents changes; run the consumer project's own checks for application changes.
