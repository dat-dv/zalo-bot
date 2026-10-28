# Webhook Messaging API

> Developer guide (Vietnamese): [`webhook.md`](../../../docs/modules/zca/webhook.md)

## Purpose

Lets external systems ask the bot to send a Zalo text message through the bot's ZCA account (notifications from other apps, scripts, automations). The bot only lists and messages the **recipients** an admin picked in Settings → Webhook; an outside caller never sees or reaches the rest of the bot's directory.

## Endpoint & Contracts

- **Endpoints**: `POST /api/webhooks/send` (route key `API_ROUTES.webhookSendMessage`) and `GET /api/webhooks/targets` (`API_ROUTES.webhookTargets`), both behind the webhook key. Admin-only `GET`/`PUT /api/webhooks/recipients` (`API_ROUTES.webhookRecipients`). No aliases.
- **Contracts** (`@zalobot/contracts`): `IWebhookSendMessageRequest`, `IWebhookSendMessageResponse`, `IWebhookSendResult`, `IWebhookTargetsQuery`, `IWebhookTarget`, `IWebhookTargetsResponse`, `IWebhookRecipient`, `IUpdateWebhookRecipientsRequest`.
- **Code**: `apps/api/src/zca/webhook/` (`ZcaWebhookController`, `recipientEntries`, `WebhookApiKeyGuard`, `isWebhookKeyValid`, `WebhookRateLimiter`, `WebhookSendMessageDto`, `WebhookTargetsQueryDto`, `toWebhookTargets`, `WebhookRecipientService`, `WebhookRecipientsController`, `UpdateWebhookRecipientsDto`).

## Authentication (fail-closed)

- `WEBHOOK_API_KEY` empty → webhook is **off**: every call gets `404` (endpoint looks absent). Logged once at startup, not per request.
- Set → key must be ≥ 32 chars (`WEBHOOK_API_KEY_MIN_LENGTH`); the env validator refuses to boot otherwise.
- Caller sends `x-api-key: <KEY>` or `Authorization: Bearer <KEY>`. Compared with `timingSafeEqual` over SHA-256 digests (hides length). Missing/wrong → `401`.
- One shared key for all callers; rotate = change env + restart.

## Recipients

- Table `webhook_recipients` (`WebhookRecipientEntity`, migration `CreateWebhookRecipients1725000000000`): `thread_id` (PK), `thread_name` (name when picked), `thread_type` (`user`/`group`), `created_at`.
- Admin API (dashboard admin JWT via `requireDashboardAdmin`, **not** the webhook key): `GET /api/webhooks/recipients`, `PUT /api/webhooks/recipients` with `{ recipients: IWebhookRecipient[] }`. The whole list replaces the saved one in one transaction; duplicates collapse; ≤ 50 (`WEBHOOK_RECIPIENTS_MAX`). Separate controller because `ZcaWebhookController` applies `WebhookApiKeyGuard` to all its routes.
- Order everywhere (list, broadcast, targets): groups first, then by name.
- UI: Settings → Webhook tab (see `modules/settings/README.md`).

## Send (`POST /api/webhooks/send`)

- `targetId` (string, optional): omitted → send to **every** recipient; given → must be a saved recipient, else `403`. Not blank, ≤ 64 chars, trimmed.
- `message` (string, required): must contain a non-whitespace char, ≤ 5000 chars (`WEBHOOK_MESSAGE_MAX_LENGTH`, ~3 Zalo messages). `ZcaMessengerService` splits at 1900 chars.
- Thread type always comes from the saved recipient; there is no `threadType` field (callers still sending it are fine: the global `ValidationPipe` whitelist strips it).
- Recipients are messaged one after another (one ZCA account; a burst looks like spam). A send that throws or returns no `msgId` fails for that recipient only.
- Sent inside `OutgoingMemoryKind.run('system', ...)`: in listened threads the message is stored as `system`, never ingested into long-term memory (only `chat` and `action` are).

## Targets (`GET /api/webhooks/targets`)

- Why: the caller's website shows a picker (avatar + name) so its users choose the right `targetId`. It lists the saved recipients only.
- Same key guard. Query: `type` (`user`/`group`), `q` (≤ 100 chars, matched on `name` via `foldVietnamese`: case- and diacritic-insensitive).
- Source: saved recipients joined by `recipientEntries` with `ZcaService.getAvailableThreads(false)` (cached directory, never forces a Zalo refetch) for name, avatar and member count. A recipient missing from the directory (or only a `missingFromZalo` placeholder) keeps its saved name, `avatar: null`.
- Item: `{ id, name, type, avatar: string | null, totalMembers? (groups) }`. `id` = `targetId` for send. Never exposes `phoneNumber`, `alias`, `zaloName`, `isListened`.
- `200`: `{ success: true, data: { items, fetchedAt } }` (`fetchedAt` = last directory fetch, `null` if never). Errors: `400`, `401`, `404`, `429`, `503`.

## Rate Limit

- Per scope, across all callers (`WebhookRateLimiter.tryCall(scope)`, Redis `webhook:<scope>:calls` via `incrWithTtl`; in-process counter when Redis is down): `send` 30 calls / 60 s (per call, not per recipient), `targets` 10 calls / 60 s. Separate counters so listing never eats the send quota.
- Counted after the key check, so wrong-key calls do not use up the quota. Over the cap → `429`, nothing sent.

## Send Responses

- `200`: `{ success: true, data: { sent, failed, results: [{ targetId, threadType, success, msgId?, cliMsgId? }] } }` when at least one recipient got a `msgId`; partial failures show in `results`.
- `400`: validation failure (missing `message`, blank or too long `targetId`/`message`).
- `401`: missing/invalid key. `403`: `targetId` is not a saved recipient. `404`: webhook off. `409`: no recipient saved.
- `429`: rate limit. `503`: ZCA not logged in.
- `502`: no recipient got the message.

## Out of Scope

- No attachments, mentions, named recipient lists, or audit log rows for webhook sends.
