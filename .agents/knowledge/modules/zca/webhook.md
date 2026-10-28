# Webhook Messaging API

> Developer guide (Vietnamese): [`webhook.md`](../../../docs/modules/zca/webhook.md)

## Purpose

Lets external systems ask the bot to send a Zalo text message to a user or group through the bot's ZCA account (notifications from other apps, scripts, automations).

## Endpoint & Contracts

- **Endpoints**: `POST /api/webhooks/send` (route key `API_ROUTES.webhookSendMessage`) `GET /api/webhooks/targets` (`API_ROUTES.webhookTargets`) and `GET /api/webhooks/status` (`API_ROUTES.webhookStatus`). No aliases.
- **Contracts** (`@zalobot/contracts`): `IWebhookSendMessageRequest`, `IWebhookSendMessageResponse`, `IWebhookTargetsQuery`, `IWebhookTarget`, `IWebhookTargetsResponse`, `IWebhookCallLimit`, `IWebhookStatusResponse`.
- **Code**: `apps/api/src/zca/webhook/` (`ZcaWebhookController`, `WebhookApiKeyGuard`, `isWebhookKeyValid`, `WebhookRateLimiter`, `WebhookSendMessageDto`, `WebhookTargetsQueryDto`, `toWebhookTargets`, `WebhookIpLimitGuard`, `WebhookIpLimiter`; client IP via `common/utils/client-ip.util.ts` `getClientIp`, shared with the dashboard access-code sign-in).

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

## Status (`GET /api/webhooks/status`)

- Why: callers check whether a send can go out (show "Zalo disconnected", pause their queue) and how many calls are left, instead of learning from a `503`/`429`.
- Same key guard. Always `200` with a valid key, also while ZCA is logged out (never `503`).
- `data`: `ready` (send can go out now; today = `zaloLoggedIn`, kept separate so more conditions can join without breaking callers), `zaloLoggedIn`, `directoryFetchedAt`, `limits.{send,targets}` = `{ limit, remaining, windowSeconds }`, `checkedAt`.
- `remaining` reads the counter without recording a call (`WebhookRateLimiter.remaining`: Redis `get`; in-process counter while Redis is down), clamped to `0..limit`, shared by every caller.
- Never exposes the bot's Zalo id/name, listened thread count, QR or proxy state (those stay on admin `GET /api/zca/status`).

## Per-IP Limits (before the key check)

- Why: per-route quotas only count calls with a valid key; without this, keyless callers could flood the API and keep guessing keys.
- `@UseGuards(WebhookIpLimitGuard, WebhookApiKeyGuard)` on every webhook route; order matters.
- Client IP: `cf-connecting-ip` → `x-real-ip` → `req.ip` (no `trust proxy`). Forgeable by callers that bypass Cloudflare: they can dodge the per-IP limits but still cannot guess the 64-hex key. No all-IP cap on wrong keys on purpose (an attacker would use it to block the real integrator). Recommended outside code: Cloudflare rate-limit rule on `/api/webhooks/*`, origin reachable only through Cloudflare.
- `WebhookIpLimitGuard`: IP locked → `429`; else counts `webhook:ip:<ip>:requests` (60 s) and refuses with `429` above 120 (`WEBHOOK_IP_MAX_REQUESTS`), valid key or not. Logs only the first refusal of the minute.
- `WebhookApiKeyGuard`: on a wrong/missing key calls `WebhookIpLimiter.recordFailedKey(ip)` (`webhook:ip:<ip>:failed`, 15 min). The 11th within 15 min (`WEBHOOK_IP_MAX_FAILED_KEYS` = 10) sets `webhook:ip:<ip>:locked` for 15 min (`WEBHOOK_IP_LOCK_SECONDS`) and logs once; a locked IP is refused even with the right key. Webhook off (404) is not counted.
- Redis down: counters and locks kept in process (single instance still limited).

## Rate Limit

- Per scope, across all callers (`WebhookRateLimiter.tryCall(scope)`, Redis `webhook:<scope>:calls` via `incrWithTtl`; in-process counter when Redis is down): `send` 30 calls / 60 s, `targets` 10 / 60 s, `status` 60 / 60 s. Separate counters so no route eats another's quota.
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
