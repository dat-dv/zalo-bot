---
metadata:
  agent-artifact:
    id: global-financial-report-contracts-knowledge
    type: documentation
    depends_on:
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/finance/finance.service.ts
      - packages/contracts/src/index.ts
---

# Financial Report Contracts

Human guide: [Financial Report Contracts](../../docs/global/financial-report-contracts.md).

Both routes live in `ReportsController`, authenticate with the dashboard access token, and are scoped to the token's user. Responses use `IApiResponse<T>` (`{ data: T }`); paths are `API_ROUTES.debts` / `API_ROUTES.expenses` in `@zalobot/contracts`.

- `GET /api/debts?status=active|settled` -> `IDebtListItem[]`. Up to 200 debts ordered by `occurredAt`, `createdAt`, `id` descending. Without `status`, all statuses are returned. No parent filter: child debts appear both as top-level rows and under their parent's `children`. Each item includes `payments` and `childCount`; `status` falls back to `settled` when `remainingAmount === 0`.
- `GET /api/expenses` -> `IExpenseListItem[]`. Up to 200 newest `expense` transactions; the handler returns only `id`, `category`, `note`, `amount`, `occurredAt` (optional contract fields such as `paymentMethod`, `currency` are not populated).

Neither route mutates data. Finance domain rules: [Finance Domain](finance-domain.md).
