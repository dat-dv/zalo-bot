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
      - apps/api/src/database/migrations/1724970000000-AddAuditLogActorName.ts
      - apps/api/src/users/users.service.ts
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

- `audit/audit-context.ts`: module-level `AsyncLocalStorage<{ source, actorId?, actorName?, channelId? }>` (not a Nest provider, so auth helpers and the TypeORM subscriber reach it without module imports). API: `run`, `runAsSystem`, `current`, `setActor`, plus `zaloAuditContext(senderId, channelId, senderName?)` (ids as string or number; name trimmed, kept only when non-empty).
- `AuditActorSource` (contracts): `dashboard` | `zalo` | `system`.
- Who sets it:
  - **Dashboard**: `AuditContextMiddleware` (CommonModule, every route) runs `{ source: 'dashboard' }`; `getDashboardUserId` / `getDashboardUserIdFromBrowser` call `setActor` after the token verifies (all controllers, incl. `ReportsController.getAccessUserId`, go through them). Only verified ids are recorded; sign-in endpoints write before the user is known → `actorId` NULL.
  - **Zalo**: `ZcaService.dispatchMessage` / `dispatchReaction` run plugins in `zaloAuditContext(uidFrom, threadId, dName)` (sender's Zalo display name).
  - **Confirmed pending action**: `processConfirm` runs `executeConfirmed` in `zaloAuditContext(pending.userId, pending.chatId, name)` → credited to the **requester**, not to whoever typed `yes <code>` or added the last ❤️. The approver is not recorded. `PendingAction` stores no requester name, so `name` = the current sender's name only when the current actor is the requester; otherwise none (never the approver's name).
  - **System**: `ReminderProcessor.process`, `TaskReminderProcessor.process`, `CalendarService.runImport` (Google import) use `runAsSystem`, so work queued from a request is not credited to it. No context at all → `system`.
- `AuditLogSubscriber` writes `actorId = context.actorId ?? NULL`, `actorName = context.actorName ?? NULL`, `actorSource = context.source ?? 'system'`, `channelId`. It never derives the actor from the row (`userId` / `createdByUserId`) — that bug credited edits of a shared transaction to its creator.
- `UserMergeService` writes its own audit row with `actorSource: 'dashboard'`.

## Data (`audit_logs`)

- Columns: `id`, `table_name`, `record_id`, `action` (`insert|update|remove`), `actor_id`, `actor_name` (Zalo display name at write time; Zalo source only), `actor_source` (NULL = legacy), `channel_id`, `before_data`/`after_data` (simple-json text, secrets redacted at write), `created_at`.
- Migration `1724950000000-AddAuditLogActorSource`: adds `actor_source`, `channel_id`, index `IDX_audit_logs_created_at (created_at DESC)`. Legacy rows are not backfilled: their `actor_id` is the row creator (the UI flags them).
- Migration `1724970000000-AddAuditLogActorName`: adds nullable `actor_name`, not backfilled. Why: group members who are not the bot's friends are missing from the ZCA directory and often have no `users.first_name`.
- Fidelity: `save`/`remove` → full row (+ before copy on update). Repository/query-builder `update()` → only written values, `record_id` usually NULL, no before copy. `delete()` by criteria → row with no data. `callListeners(false)` writes (calendar import) → nothing. `zca_messages` and `audit_logs` are skipped.

## API (admin only, `requireDashboardAdmin`)

`AuditController` lives in `AuditAdminModule` (imports `AuditModule`, `UsersModule`, `DashboardAuthModule`) because `UsersModule → ZcaModule → AuditModule` would otherwise cycle.

- `GET /api/audit-logs` (`API_ROUTES.auditLogs`), query parsed by `parseAuditLogListQuery` (repeated keys = lists, unknown values → 400):
  - `tables[]` (`AuditTableName`), `actions[]`, `sources[]` (`AuditSourceFilter` = source | `legacy` → `actor_source IS NULL`), `actorIds[]`, `recordId`, `startAt`/`endAt` (ISO, inclusive, start ≤ end), `includeTechnical` (`true`), `limit` (default 50, capped 200), `offset`.
  - No `tables` and no `includeTechnical` → excludes `AUDIT_TECHNICAL_TABLES` (`user_tokens`, `dashboard_exchange_tokens`, `reminder_times`, `task_reminder_times`). Picking a table overrides that.
  - Order `created_at DESC, id DESC`. Response `IAuditLogListResponse { items, total, limit, offset, facets.actors }`; `facets.actors` = every distinct `actor_id` in the table (filter-independent, `GROUP BY actor_id` + `MAX(actor_name)`), with name and `isOwner`.
  - **Actor name precedence** (`actorNameOf`): ZCA directory name (`UsersService.resolveZaloNames`: cached `getAvailableThreads(false)`, `user` entries, `alias || name || displayName`; never calls Zalo; errors → skipped) → the row's `actor_name` → `users.first_name` → ''. Same order for `facets.actors` and the detail. `AuditController` passes the resolver as `AuditNameResolver` so `AuditModule` stays free of `UsersModule`.
  - Item `IAuditLogListItem`: ids, `actorName` (see precedence, else ''), `actorIsOwner` (`dashboard-owner`), `actorSource`, `channelName`/`channelType` (`zca_thread_configs`), `changedFields` (`computeChangedFields`: update with before → differing keys; without before → written keys; `updatedAt` ignored; insert/remove → []), `createdAt`. No before/after data in the list.
- `GET /api/audit-logs/:id` (`API_ROUTES.auditLog(id)`) → `IAuditLogDetail` (= item + `beforeData`, `afterData`), 404 when missing.
- `AUDIT_TABLES` (contracts) lists 17 tables with `group` (`finance|planning|system`) and `technical`.

## Web (`/activity`)

- Nav: section HỆ THỐNG, `page: 'activity'`, icon `activity`, `adminOnly`. Header `audit.title` / `audit.subtitle`. Route page wraps `ActivityScreen` in `Suspense` (`useSearchParams`).
- `ActivityScreen`: 403 → `ZcaAdminOnlyNotice`; 401 → `SessionStateScreen reason="expired"` (sign-in by code, like the other pages; retry refetches); other errors → inline alert + Retry. Neither 401 nor 403 is retried. One `DataPanel` with `AuditFilters` in the toolbar, `AuditTable`, footer `from–to / total` + ← → (50 per page, `AUDIT_PAGE_SIZE`; buttons disabled while fetching). `keepPreviousData` keeps the page while the next loads.
- URL state (`audit-url-state.ts`, mirrored with `history.replaceState`): `table`, `action`, `source`, `actor` (repeated), `recordId`, `from`/`to` (local `YYYY-MM-DD` → whole local days in ISO), `technical=1`, `page`. Unknown values are dropped. Any filter change resets page 1. `APP_ROUTES.activityFor(table, recordId)` builds a pre-filtered link.
- Filters (`AuditFilters` + internal `AuditFilterFields` with layout `row` | `stack`): one native select per dimension (tables grouped by `optgroup`), two date inputs, "Show technical records" checkbox (hint lists what is hidden), a record chip (✕ clears) and "Clear filters".
  - Desktop/tablet: one wrapping row of 28px controls.
  - Phone (`useIsPhone`): the toolbar is only a 32px **Filters** chip (`audit.filter.open`, or `audit.filter.openCount` "Filters · n" highlighted when n > 0; n = `countActiveAuditFilters`: tables, actions, sources, actors, from, to, technical — not the record id), the record chip and "Clear filters". The chip opens a `Modal` bottom sheet "Filter the log" (`audit.filter.sheetTitle`): stacked full-width labelled fields, 40px (`TAP_INPUT`), dates side by side, technical hint shown as text; changes apply immediately (same as desktop); footer "Clear filters" (when n > 0) + **Done** (`audit.filter.done`) closes.
- Table (`disableSorting`, server order; min widths time 130, actor 180, data 200, changes 160): time; actor (name, source badge — amber "Legacy" with hint when `actorSource` NULL — and chat); data (**button** opening the detail: action colored via `AUDIT_ACTION_TONE`, table label in sky with hover underline; then `…last8` of record id or violet "Bulk" badge); changed-field chips (max 4 + `+n`); `actions` column "View". The data cell is the primary way in: the mandatory ID column (~287px) can push "View" past a 1280px viewport (fully visible from ~1360px). Phone list: primary `action · table`, secondary `actor · source · chat`, trailing time; tap → detail sheet with the View button.
- `AuditDetailDialog`: meta (time, actor · source, chat, action · table, record id), legacy/bulk notes, field table: update → Field | Before | After, changed rows first and highlighted; insert → after only; remove → before only. Detail query `staleTime: Infinity`. "History of this record" sets `table` + `recordId` filters in place.
- Labels: `audit-labels.ts` (`describeAuditActor`: name → `session.owner` → `Unnamed (…last4)` → System/Unknown; `describeAuditChannel`: group name / `Zalo group` / `Direct chat`; `describeAuditChange(action, table)`: "Added · Reminders", also used by the home Activity panel). Strings `audit.*`, `nav.activity`.
- Entry points: home Activity panel "View all" (admins), transaction details "View change history" (admins) — see modules/dashboard.

## Tests

- API: `audit-context.spec.ts` (incl. sender name), `audit-log.subscriber.spec.ts` (context actor + name, no row fallback, system default, `zca_messages` skipped), `audit-log-query.spec.ts`, `audit.service.spec.ts` (filters, technical exclusion, legacy source, mapping, facets, name precedence, resolver failure, `listRecent` technical exclusion, 403), `transaction-confirmation.service.spec.ts` (confirmed action credited to requester; name kept only for self-confirmation), `users-session-profile.spec.ts` (`resolveZaloNames`).
- Web: `audit-url-state.spec.ts` (incl. `countActiveAuditFilters`), `audit-labels.spec.ts` (incl. `describeAuditChange`).
