# Webhook Messaging API

> Developer guide (Vietnamese): [`webhook.md`](../../../docs/modules/zca/webhook.md)

## Purpose

Lets external systems ask the bot to send a Zalo text message to a user or group through the bot's ZCA account (notifications from other apps, scripts, automations).

## Endpoint & Contracts

- **Endpoints**: `POST /api/webhooks/send` (route key `API_ROUTES.webhookSendMessage`) and `GET /api/webhooks/targets` (`API_ROUTES.webhookTargets`). No aliases.
- **Contracts** (`@zalobot/contracts`): `IWebhookSendMessageRequest`, `IWebhookSendMessageResponse`, `IWebhookTargetsQuery`, `IWebhookTarget`, `IWebhookTargetsResponse`.
- **Code**: `apps/api/src/zca/webhook/` (`ZcaWebhookController`, `WebhookApiKeyGuard`, `isWebhookKeyValid`, `WebhookRateLimiter`, `WebhookSendMessageDto`, `WebhookTargetsQueryDto`, `toWebhookTargets`).

## Authentication (fail-closed)

- `WEBHOOK_API_KEY` empty → webhook is **off**: every call gets `404` (endpoint looks absent). Logged once at startup, not per request.
- Set → key must be ≥ 32 chars (`WEBHOOK_API_KEY_MIN_LENGTH`); the env validator refuses to boot otherwise.
- Caller sends `x-api-key: <KEY>` or `Authorization: Bearer <KEY>`. Compared with `timingSafeEqual` over SHA-256 digests (hides length). Missing/wrong → `401`.
- One shared key for all callers; rotate = change env + restart.

## Request Body

- `targetId` (string, required): Zalo user id or group id. Not blank, ≤ 64 chars.
- `message` (string, required): must contain a non-whitespace char, ≤ 5000 chars (`WEBHOOK_MESSAGE_MAX_LENGTH`, ~3 Zalo messages). `ZcaMessengerService` splits at 1900 chars.
- `threadType` (`'user' | 'group'`, optional): omitted → `ZcaService.resolveThreadType` (known threads, directory snapshot, thread config, else user).

## Targets (`GET /api/webhooks/targets`)

- Why: recipients are picked and stored on the **caller's** website; it needs the bot's chats with avatars to let its users pick the right `targetId`. Zalobot has no recipient settings of its own.
- Same key guard. Query: `type` (`user`/`group`), `q` (≤ 100 chars, matched on `name` via `foldVietnamese`: case- and diacritic-insensitive).
- Source: `ZcaService.getAvailableThreads(false)`: all friends and groups of the bot from the cached directory (memory/Redis, background refresh when stale). Never forces a Zalo refetch. Placeholder rows (`missingFromZalo`, left groups) are dropped.
- Item: `{ id, name, type, avatar: string | null, totalMembers? (groups) }`. `id` = `targetId`, `type` = `threadType` for send. Never exposes `phoneNumber`, `alias`, `zaloName`, `isListened`.
- Order: groups first, then by name (`localeCompare` `vi`).
- `200`: `{ success: true, data: { items, fetchedAt } }` (`fetchedAt` = last directory fetch, `null` if never). Errors: `400`, `401`, `404`, `429`, `503`.

## Rate Limit

- Per scope, across all callers (`WebhookRateLimiter.tryCall(scope)`, Redis `webhook:<scope>:calls` via `incrWithTtl`; in-process counter when Redis is down): `send` 30 calls / 60 s, `targets` 10 calls / 60 s. Separate counters so listing never eats the send quota.
- Counted after the key check, so wrong-key calls do not use up the quota. Over the cap → `429`, nothing sent.

## Memory

- Sent inside `OutgoingMemoryKind.run('system', ...)`: in listened threads the message is stored as `system`, never ingested into long-term memory (only `chat` and `action` are).

## Responses

- `200`: `{ success: true, data: { targetId, msgId, cliMsgId? } }`. Returned only when ZCA gave a `msgId`.
- `400`: validation failure (missing, blank, too long, bad `threadType`).
- `401`: missing/invalid key. `404`: webhook off.
- `429`: rate limit. `503`: ZCA not logged in.
- `502`: ZCA send failed, or no message went out (no `msgId`).

## Out of Scope

- No attachments, mentions, multiple recipients, or audit log rows for webhook sends.
