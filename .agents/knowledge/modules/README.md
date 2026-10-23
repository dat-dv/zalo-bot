# Feature Modules & Bounded Contexts

This directory contains specifications and domain knowledge organized by feature module / Bounded Context boundaries.

## Module Structure

Each subfolder under `modules/` mirrors a web module in `apps/web/src/modules/<name>/`. Backend areas in `apps/api/src/<area>` are documented in the module they serve or under `global/` (e.g. `global/finance-domain.md`).

Each module document covers:
1. **Business Purpose & API Rationale**: Why specific APIs exist and what business problems they solve.
2. **Product & UI/UX Requirements**: Screen layout, responsive behavior (e.g. mobile drawer vs desktop buttons, required action triggers).
3. **Data Flow & Technical Seams**: Local state, DTO payload contracts, and integration points.

## Modules Index
- [Audit](audit/README.md): Activity log: who changed what (actor recorded via `AuditContext`), admin page `/activity`.
- [Authentication](auth/README.md): Dashboard access token storage and lifecycle.
- [Calendar](calendar/README.md): Shared calendar stored in `calendar_events` with a Google Calendar copy; month/agenda UI, create/edit/delete, re-sync.
- [Contacts](contacts/README.md): Debt-contact retrieval and presentation.
- [Debts](debts/README.md): Active receivables and payables reporting.
- [Dashboard](dashboard/README.md): Personal reports, statistics, and operational data views.
- [Expenses](expenses/README.md): Expense-only transaction history reporting.
- [Reminders](reminders/README.md): Scheduled user reminders management and status updates.
- [Settings](settings/README.md): System preferences and custom finance categories management.
- [Tasks](tasks/README.md): Shared task list stored only in `tasks` (no Google Tasks sync); `/tasks` UI.
- [Users](users/README.md): Multi-tenant user directory, Admin/User roles, and bot authorization.
- [ZCA](zca/README.md): Personal Zalo account client integration, channel-specific bot rules, and Google Drive partitions.


