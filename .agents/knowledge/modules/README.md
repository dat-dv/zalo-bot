# Feature Modules & Bounded Contexts

This directory contains specifications and domain knowledge organized by feature module / Bounded Context boundaries.

## Module Structure

Each subfolder under `modules/` represents a single feature module (e.g. `auth`, `homepage`, `platform-accounts`).

Each module document covers:
1. **Business Purpose & API Rationale**: Why specific APIs exist and what business problems they solve.
2. **Product & UI/UX Requirements**: Screen layout, responsive behavior (e.g. mobile drawer vs desktop buttons, required action triggers).
3. **Data Flow & Technical Seams**: Local state, DTO payload contracts, and integration points.

## Modules Index
- [Authentication](auth/README.md): Dashboard access token storage and lifecycle.
- [Calendar](calendar/README.md): Google Calendar event queries, updates, and deletions.
- [Contacts](contacts/README.md): Debt-contact retrieval and presentation.
- [Debts](debts/README.md): Active receivables and payables reporting.
- [Dashboard](dashboard/README.md): Personal reports, statistics, and operational data views.
- [Expenses](expenses/README.md): Expense-only transaction history reporting.
- [Finance](finance/README.md): User-scoped transactions, debt records, categories, and places.
- [Reminders](reminders/README.md): Scheduled user reminders management and status updates.
- [Settings](settings/README.md): System preferences and custom finance categories management.
- [Tasks](tasks/README.md): Google Tasks retrieval, updates, and state synchronization.
- [Users](users/README.md): Multi-tenant user directory, Admin/User roles, and bot authorization.
- [ZCA](zca/README.md): Personal Zalo account client integration, channel-specific bot rules, and Google Drive partitions.


