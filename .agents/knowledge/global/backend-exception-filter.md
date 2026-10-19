---
metadata:
  agent-artifact:
    id: global-backend-exception-filter-knowledge
    type: documentation
    depends_on:
      - apps/api/src/common/common.module.ts
      - apps/api/src/common/filters/global-exceptions.filter.ts
---

# Backend Exception Filter Architecture

`GlobalExceptionsFilter` (`@Catch()` for every exception) is registered via `APP_FILTER` in `CommonModule` (`apps/api/src/common/common.module.ts`), which `AppModule` imports. The same module registers `AppValidationPipe` (`APP_PIPE`), the `Timeout`, `Logging`, and `Transform` interceptors, and the `RequestId` + `HttpLogger` middlewares.

## Key Responsibilities

1. **Uniform Error Contract**: HTTP errors follow `IApiErrorResponse` from `@zalobot/contracts`: `{ statusCode, message, error, timestamp, path, requestId? }`. `RequestIdMiddleware` reuses an incoming `x-request-id` / `x-correlation-id` or generates a UUID, so HTTP errors normally carry `requestId`, also echoed in the `x-request-id` response header.
2. **Exception Mapping** (first match wins):
   - `HttpException`: keeps status; `message` is the string or array from the response body (validation errors), `error` from the body or the class name without `Exception`.
   - TypeORM `EntityNotFoundError`: `404`, `Resource not found`.
   - TypeORM `QueryFailedError`: unique/duplicate violations (`duplicate key value`, `UNIQUE constraint`, `23505`) → `409 Database constraint violation`; any other query failure → `500 Database query failed`.
   - Upstream HTTP client errors (an `Error` with numeric `response.status`, e.g. axios/googleapis): `4xx` passes through with the upstream status and message (`data.error`, `data.error.message`, or `error_description`); `5xx`/other → `502 Bad Gateway` with a generic Vietnamese message.
   - Other `Error`: `500`; message is `Internal server error` when `NODE_ENV === 'production'`, otherwise the raw error message.
   - Non-`Error` throwables: `500 Internal server error`.
3. **Context Safety**: Non-HTTP contexts (e.g. scheduled jobs) are only logged; no response is written.
4. **Server Logging**: `>= 500` logs at error level with stack (plus `QueryFailedError` details); `< 500` logs at warn level. Each line includes method, path, status, message, and request id.
