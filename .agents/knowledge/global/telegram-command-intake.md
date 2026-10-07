# zalo Command Intake

The API instance receives zalo commands through zalograf long polling managed by `zaloLauncherService` when `zalo_LONG_POLLING_ENABLED=true` (default). Exactly one instance per bot token may poll updates at a time. If a duplicate instance is detected (`409 Conflict`), the launcher pauses polling and retries periodically with non-blocking backoff without crashing the NestJS application or web proxy. When polling is disabled, a separately configured webhook or worker must deliver updates; otherwise commands such as `/help` cannot reach their handlers.

Direct command handlers must remain independently testable. The fallback harness verifies `/start` and `/help` still reply when dashboard-link issuance fails, when the origin is a localhost/loopback URL (omitting invalid inline URL buttons), and when zalo API rejects invalid markup.

The API test command must discover every `src/**/*.spec.ts` file and run through a TypeScript runner that honors NestJS decorators. Sensitive callbacks queue a user-bound confirmation; the action executes only after the same user confirms it.
