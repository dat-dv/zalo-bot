# Webhook Messaging API

> Developer guide (Vietnamese): [`webhook.md`](../../../docs/modules/zca/webhook.md)

## Purpose

Lets external systems ask the bot to send a Zalo text message to a user or group through the bot's ZCA account (notifications from other apps, scripts, automations).

## Endpoint & Contracts

- **Endpoint**: `POST /api/webhooks/send` only (no aliases). Route key `API_ROUTES.webhookSendMessage`.
- **Contracts** (`@zalobot/contracts`): `IWebhookSendMessageRequest`, `IWebhookSendMessageResponse`.
- **Code**: `apps/api/src/zca/webhook/` (`ZcaWebhookController`, `WebhookApiKeyGuard`, `isWebhookKeyValid`, `WebhookRateLimiter`, `WebhookSendMessageDto`).

## Authentication (fail-closed)

- `WEBHOOK_API_KEY` empty → webhook is **off**: every call gets `404` (endpoint looks absent). Logged once at startup, not per request.
- Set → key must be ≥ 32 chars (`WEBHOOK_API_KEY_MIN_LENGTH`); the env validator refuses to boot otherwise.
- Caller sends `x-api-key: <KEY>` or `Authorization: Bearer <KEY>`. Compared with `timingSafeEqual` over SHA-256 digests (hides length). Missing/wrong → `401`.
- One shared key for all callers; rotate = change env + restart.

## Request Body

- `targetId` (string, required): Zalo user id or group id. Not blank, ≤ 64 chars.
- `message` (string, required): must contain a non-whitespace char, ≤ 5000 chars (`WEBHOOK_MESSAGE_MAX_LENGTH`, ~3 Zalo messages). `ZcaMessengerService` splits at 1900 chars.
- `threadType` (`'user' | 'group'`, optional): omitted → `ZcaService.resolveThreadType` (known threads, directory snapshot, thread config, else user).

## Rate Limit

- 30 calls per 60 s across all callers (`WebhookRateLimiter`, Redis `webhook:send:calls` via `incrWithTtl`; in-process counter when Redis is down).
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
