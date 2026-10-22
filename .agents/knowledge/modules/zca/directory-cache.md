---
metadata:
  agent-artifact:
    id: zca-directory-cache-knowledge
    type: documentation
    depends_on:
      - apps/api/src/zca/zca-directory-cache.ts
      - apps/api/src/zca/zca.constants.ts
      - apps/api/src/zca/zca.service.ts
      - apps/api/src/zca/zca.controller.ts
      - apps/api/src/users/users.service.ts
      - apps/web/src/modules/zca/api/zca-api.ts
      - apps/web/src/modules/zca/api/zca-query.ts
      - apps/web/src/modules/zca/view/zca-screen.tsx
---

# ZCA Directory Cache (groups, friends, aliases)

Owner: Core Engineering Team · Status: active

Human guide: [Cache danh bạ Zalo](../../../docs/modules/zca/directory-cache.md). Design record: `.agents/artifacts/zca-directory-redis-cache/`.

## Purpose

- The only ZCA *read* calls are the directory calls behind `ZcaService.getAvailableThreads`: `getAllGroups`, `getGroupInfo` (batches of 50), `getAliasList`, `getAllFriends`. Every other ZCA call is an action (send, undo, react, delete) or on-demand history (`getGroupChatHistory`) and is not cached.
- Callers: `/api/zca/threads`, `UsersService.getUsers()` (users list, reports, LLM users tool) and `syncUsersWithZca()`. Before, an in-memory 3-minute cache meant these re-called Zalo every few minutes and after every restart (rate limit 429 risk).
- Rule: Zalo is called only when no snapshot exists, when the snapshot is stale (in the background), or when an admin presses a refresh button.

## Storage

- Redis key `zca:directory:<ownId>` (`zcaDirectoryRedisKey`), JSON `ZcaDirectorySnapshot` = `{ fetchedAt, complete, groups[], friends[] }`. Entries are `ZcaDirectoryEntry` (`AvailableThread` without `isListened`); `friends` already contains alias-only contacts.
- Per ZCA account (`ownId`), so another account never reads the old directory. Hard TTL `ZCA_DIRECTORY_HARD_TTL_SECONDS` (30 days) only cleans abandoned keys.
- `parseZcaDirectorySnapshot` validates on read (type guards); malformed data = cache miss; invalid entries are dropped.
- In-process copy (`directorySnapshot` + `directoryOwnerId`) mirrors Redis; Redis down → behaves as memory-only cache.

## Read flow (`getAvailableThreads(forceRefresh)`)

| Case | Behavior |
| --- | --- |
| Snapshot fresh (memory or Redis) | Return it, 0 Zalo calls |
| Snapshot stale: older than `ZCA_DIRECTORY_SOFT_TTL_MS` (7 days) or `complete: false` | Return it immediately, start one background refresh |
| No snapshot | Fetch from Zalo now (cold start / first login) |
| `forceRefresh` (buttons) | Fetch from Zalo; a second forced call within `ZCA_DIRECTORY_REFRESH_COOLDOWN_MS` (30s) reuses the last result |

- Automatic fetches (cold or stale) are throttled by `ZCA_DIRECTORY_AUTO_RETRY_MS` (5 min) so a failing Zalo is not hammered; buttons bypass it (only the 30s cooldown applies).
- Concurrent fetches share one promise (`pendingDirectoryFetch`).
- `isListened` and the whitelist fallback (listened ids Zalo did not return, shown as `Cuộc trò chuyện <id>`) are computed on read, never stored.
- `getDirectoryFetchedAt()` exposes `fetchedAt`; `GET /api/zca/threads` returns `{ threads, fetchedAt }`.

## Partial failures (`mergeZcaDirectory`)

- Groups section is incomplete when `getAllGroups` or any `getGroupInfo` batch fails; friends section when `getAllFriends` fails. An incomplete section keeps the previous snapshot's entries (if any), and the snapshot is saved with `complete: false`, so it is retried like a stale one.
- `getAliasList` failure does not mark the snapshot incomplete (some accounts cannot read aliases at all, which would cause a refetch every 5 min); aliases from the previous snapshot are reused instead.
- Nothing usable (both sections failed and empty) → keep the previous snapshot unchanged.
- Rationale: with a 7-day cache, one failed call must not wipe friends or groups for a week.

## Lifecycle

- Every login path (`login`, `startQrLogin`, `loginQR`) calls `hydrateDirectory()`: loads the snapshot from Redis (no Zalo call), fills `knownThreadTypes` so `resolveThreadType` works at once, and resets the auto/forced throttles.
- After each successful fetch: `knownThreadTypes` updated, `ThreadConfigService.reconcileThreadTypes` fire-and-forget, snapshot written to Redis.
- `logout()` clears memory and deletes `zca:directory:<ownId>`.

## Refresh triggers (only these call Zalo on demand)

- `/zca` header "Làm mới" → `GET /api/zca/threads?refresh=true` (`useRefreshZcaThreadsMutation`).
- `/zca` "Đồng bộ thông tin" → `POST /api/users/sync-zca` → `getAvailableThreads(true)`; the screen then invalidates `zcaQueryKeys.threads()`.

## Web

- `getZcaThreads` returns `ZcaThreadsResult` `{ threads, fetchedAt }`. `useZcaThreadsQuery` selects `threads`; `useZcaThreadsFetchedAtQuery` selects `fetchedAt` from the same cache entry. `staleTime` 10 min (server already caches).
- Header shows `zca.directory.fetchedAt` ("Cập nhật lúc {time}", `Intl` short date+time in the active locale) next to the refresh button; tooltip `zca.directory.fetchedAtHint` explains the 7-day cache.
