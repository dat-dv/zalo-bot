---
metadata:
  agent-artifact:
    id: module-audit-knowledge
    type: documentation
    depends_on:
      - apps/api/src/audit/audit-context.ts
      - apps/api/src/audit/audit-log-query.ts
      - apps/api/src/audit/audit.service.ts
      - apps/api/src/audit/audit.controller.ts
      - apps/api/src/audit/audit.module.ts
      - apps/api/src/audit/audit-admin.module.ts
      - apps/api/src/common/middleware/audit-context.middleware.ts
      - apps/api/src/dashboard-auth/dashboard-user.ts
      - apps/api/src/database/audit-log.subscriber.ts
      - apps/api/src/database/entities/audit-log.entity.ts
      - apps/api/src/database/migrations/1724950000000-AddAuditLogActorSource.ts
      - apps/api/src/zca/zca.service.ts
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
      - apps/api/src/reminders/reminder.processor.ts
      - apps/api/src/tasks/task-reminder.processor.ts
      - apps/api/src/calendar/calendar.service.ts
      - apps/web/src/modules/audit/api/audit-api.ts
      - apps/web/src/modules/audit/api/audit-query.ts
      - apps/web/src/modules/audit/model/audit-url-state.ts
      - apps/web/src/modules/audit/model/audit-labels.ts
      - apps/web/src/modules/audit/presentation/components/audit-filters.tsx
      - apps/web/src/modules/audit/presentation/components/audit-table.tsx
      - apps/web/src/modules/audit/presentation/components/audit-detail-dialog.tsx
      - apps/web/src/modules/audit/view/activity-screen.tsx
      - apps/web/src/modules/audit/view/use-audit-filter-url-state.ts
      - apps/web/app/(private)/activity/page.tsx
      - packages/contracts/src/index.ts
---

# Audit Module (Activity Log)

Owner: Core Engineering Team · Status: active

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/audit/README.md)

## Purpose

Finance, calendar and tasks are shared stores: anyone can edit or delete anyone's rows. The activity log answers "who added, changed or deleted this, when, from where, and what was it before". `apps/api/src/audit` records and serves it; `apps/web/src/modules/audit` is the admin page `/activity` (`APP_ROUTES.activity`).

## Recording the actor (`AuditContext`)

- `audit/audit-context.ts`: module-level `AsyncLocalStorage<{ source, actorId?, channelId? }>` (not a Nest provider, so auth helpers and the TypeORM subscriber reach it without module imports). API: `run`, `runAsSystem`, `current`, `setActor`, plus `zaloAuditContext(senderId, channelId)` (ids as string or number).
- `AuditActorSource` (contracts): `dashboard` | `zalo` | `system`.
- Who sets it:
  - **Dashboard**: `AuditContextMiddleware` (CommonModule, every route) runs `{ source: 'dashboard' }`; `getDashboardUserId` / `getDashboardUserIdFromBrowser` call `setActor` after the token verifies (all controllers, incl. `ReportsController.getAccessUserId`, go through them). Only verified ids are recorded; sign-in endpoints write before the user is known → `actorId` NULL.
  - **Zalo**: `ZcaService.dispatchMessage` / `dispatchReaction` run plugins in `zaloAuditContext(uidFrom, threadId)`.
  - **Confirmed pending action**: `processConfirm` runs `executeConfirmed` in `zaloAuditContext(pending.userId, pending.chatId)` → credited to the **requester**, not to whoever typed `yes <code>` or added the last ❤️. The approver is not recorded.
  - **System**: `ReminderProcessor.process`, `TaskReminderProcessor.process`, `CalendarService.runImport` (Google import) use `runAsSystem`, so work queued from a request is not credited to it. No context at all → `system`.
- `AuditLogSubscriber` writes `actorId = context.actorId ?? NULL`, `actorSource = context.source ?? 'system'`, `channelId`. It never derives the actor from the row (`userId` / `createdByUserId`) — that bug credited edits of a shared transaction to its creator.
- `UserMergeService` writes its own audit row with `actorSource: 'dashboard'`.

## Data (`audit_logs`)

- Columns: `id`, `table_name`, `record_id`, `action` (`insert|update|remove`), `actor_id`, `actor_source` (NULL = legacy), `channel_id`, `before_data`/`after_data` (simple-json text, secrets redacted at write), `created_at`.
- Migration `1724950000000-AddAuditLogActorSource`: adds `actor_source`, `channel_id`, index `IDX_audit_logs_created_at (created_at DESC)`. Legacy rows are not backfilled: their `actor_id` is the row creator (the UI flags them).
- Fidelity: `save`/`remove` → full row (+ before copy on update). Repository/query-builder `update()` → only written values, `record_id` usually NULL, no before copy. `delete()` by criteria → row with no data. `callListeners(false)` writes (calendar import) → nothing. `zca_messages` and `audit_logs` are skipped.

## API (admin only, `requireDashboardAdmin`)

`AuditController` lives in `AuditAdminModule` (imports `AuditModule`, `UsersModule`, `DashboardAuthModule`) because `UsersModule → ZcaModule → AuditModule` would otherwise cycle.

- `GET /api/audit-logs` (`API_ROUTES.auditLogs`), query parsed by `parseAuditLogListQuery` (repeated keys = lists, unknown values → 400):
  - `tables[]` (`AuditTableName`), `actions[]`, `sources[]` (`AuditSourceFilter` = source | `legacy` → `actor_source IS NULL`), `actorIds[]`, `recordId`, `startAt`/`endAt` (ISO, inclusive, start ≤ end), `includeTechnical` (`true`), `limit` (default 50, capped 200), `offset`.
  - No `tables` and no `includeTechnical` → excludes `AUDIT_TECHNICAL_TABLES` (`user_tokens`, `dashboard_exchange_tokens`, `reminder_times`, `task_reminder_times`). Picking a table overrides that.
  - Order `created_at DESC, id DESC`. Response `IAuditLogListResponse { items, total, limit, offset, facets.actors }`; `facets.actors` = every distinct `actor_id` in the table (filter-independent), with name and `isOwner`.
  - Item `IAuditLogListItem`: ids, `actorName` (`users.firstName`, else ''), `actorIsOwner` (`dashboard-owner`), `actorSource`, `channelName`/`channelType` (`zca_thread_configs`), `changedFields` (`computeChangedFields`: update with before → differing keys; without before → written keys; `updatedAt` ignored; insert/remove → []), `createdAt`. No before/after data in the list.
- `GET /api/audit-logs/:id` (`API_ROUTES.auditLog(id)`) → `IAuditLogDetail` (= item + `beforeData`, `afterData`), 404 when missing.
- `AUDIT_TABLES` (contracts) lists 17 tables with `group` (`finance|planning|system`) and `technical`.

## Web (`/activity`)

- Nav: section HỆ THỐNG, `page: 'activity'`, icon `activity`, `adminOnly`. Header `audit.title` / `audit.subtitle`. Route page wraps `ActivityScreen` in `Suspense` (`useSearchParams`).
- `ActivityScreen`: 403 → `ZcaAdminOnlyNotice`. One `DataPanel` with `AuditFilters` in the toolbar, `AuditTable`, footer `from–to / total` + ← → (50 per page, `AUDIT_PAGE_SIZE`; buttons disabled while fetching). Error → inline alert + Retry. `keepPreviousData` keeps the page while the next loads.
- URL state (`audit-url-state.ts`, mirrored with `history.replaceState`): `table`, `action`, `source`, `actor` (repeated), `recordId`, `from`/`to` (local `YYYY-MM-DD` → whole local days in ISO), `technical=1`, `page`. Unknown values are dropped. Any filter change resets page 1. `APP_ROUTES.activityFor(table, recordId)` builds a pre-filtered link.
- Filters: one native select per dimension (tables grouped by `optgroup`), two date inputs, "Show technical records" checkbox (hint lists what is hidden), a record chip (✕ clears) and "Clear filters". Phone: one sideways-scrolling row (`MOBILE_TOOLBAR_ROW`), 32px controls (`PHONE_CHIP`).
- Table (`disableSorting`, server order): time; actor (name, source badge — amber "Legacy" with hint when `actorSource` NULL — and chat); data (action colored, table label, `…last8` of record id or violet "Bulk" badge); changed-field chips (max 4 + `+n`); `actions` column "View". Phone list: primary `action · table`, secondary `actor · source · chat`, trailing time; tap → detail sheet with the View button.
- `AuditDetailDialog`: meta (time, actor · source, chat, action · table, record id), legacy/bulk notes, field table: update → Field | Before | After, changed rows first and highlighted; insert → after only; remove → before only. Detail query `staleTime: Infinity`. "History of this record" sets `table` + `recordId` filters in place.
- Labels: `audit-labels.ts` (`describeAuditActor`: name → `session.owner` → `Unnamed (…last4)` → System/Unknown; `describeAuditChannel`: group name / `Zalo group` / `Direct chat`). Strings `audit.*`, `nav.activity`.
- Entry points: home Activity panel "View all" (admins), transaction details "View change history" (admins) — see modules/dashboard.

## Tests

- API: `audit-context.spec.ts`, `audit-log.subscriber.spec.ts` (context actor, no row fallback, system default, `zca_messages` skipped), `audit-log-query.spec.ts`, `audit.service.spec.ts` (filters, technical exclusion, legacy source, mapping, facets, 403), `transaction-confirmation.service.spec.ts` (confirmed action credited to requester).
- Web: `audit-url-state.spec.ts`, `audit-labels.spec.ts`.
