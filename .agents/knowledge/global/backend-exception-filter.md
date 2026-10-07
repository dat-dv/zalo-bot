# Backend Exception Filter Architecture

The NestJS backend registers a global exception filter (`GlobalExceptionsFilter`) via `APP_FILTER` in `AppModule` to trap all unhandled exceptions across HTTP endpoints and format uniform error payloads.

## Key Responsibilities

1. **Uniform Error Contract**: Every HTTP error response adheres to `IApiErrorResponse` (`{ statusCode, message, error, timestamp, path }`) defined in `@zalobot/contracts`.
2. **Exception Mapping**:
   - `HttpException` (NestJS built-ins like `NotFoundException`, `BadRequestException`): Preserves HTTP status code and response payload messages (supporting string and array validation errors).
   - `EntityNotFoundError` (TypeORM): Maps to `404 Not Found` with clean message `Resource not found`.
   - `QueryFailedError` (TypeORM PostgreSQL constraint errors such as `23505`): Maps to `409 Conflict` or `400 Bad Request` instead of leaking internal database errors.
   - Generic `Error` and unknown exceptions: Returns `500 Internal Server Error`. In production (`NODE_ENV === 'production'`), details are sanitized to `Internal server error`.
3. **Context Safety**: Non-HTTP contexts (such as zalo bot update handlers or background cron jobs) are logged safely without modifying non-existent HTTP response streams.
4. **Server Logging**: Logs full error context (method, URL, status code, and stack trace for 500 errors) using NestJS `Logger`.
