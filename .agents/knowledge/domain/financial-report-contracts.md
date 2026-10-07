# Financial Report Contracts

`GET /api/debts` returns active debt records for the authenticated user as `IDebtListItem[]`.
`GET /api/expenses` returns up to 200 newest expense transactions for the authenticated user as `IExpenseListItem[]`.

Both routes use `IApiResponse<T>` and their paths/types are defined in `@zalobot/contracts`. Data is user-scoped at the report controller and finance service boundary.
