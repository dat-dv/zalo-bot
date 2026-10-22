---
metadata:
  agent-artifact:
    id: zca-member-access-knowledge
    type: documentation
    depends_on:
      - apps/api/src/zca/access/thread-access-policy.ts
      - apps/api/src/zca/access/group-member-access.policy.ts
      - apps/api/src/zca/access/personal-access.policy.ts
      - apps/api/src/zca/access/thread-access.service.ts
      - apps/api/src/zca/guards/grant-access.guard.ts
      - apps/api/src/zca/zca-bot-feature.service.ts
      - apps/api/src/zca/zca-group-members.ts
      - apps/api/src/zca/zca.service.ts
      - apps/api/src/zca/zca.controller.ts
      - apps/api/src/zca/thread-config.service.ts
      - apps/api/src/database/entities/zca-thread-config.entity.ts
      - apps/api/src/database/migrations/1724900000000-AddMemberAccessToZcaThreadConfigs.ts
      - packages/contracts/src/index.ts
      - apps/web/src/modules/zca/model/group-members.ts
      - apps/web/src/modules/zca/presentation/components/thread-config/member-access-section.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/group-member-picker.tsx
---

# ZCA Member Access (per-thread access)

Owner: Core Engineering Team · Status: active

Human guide: [Quyền tương tác theo kênh](../../../docs/modules/zca/member-access.md). Design record: `.agents/artifacts/zca-thread-member-access/`.

## Purpose

Admins choose who may call the bot in one Zalo group (by @mention or trigger prefix) without granting those people global access on the "Zalo & Users" page. Thread access **adds to** global access, it never removes it:

```
allowed = bot account (owner / self)
       || admin
       || thread policy grants the sender   (ThreadAccessService)
       || users.grant_access = GRANTED      (global)
```

1-1 chats and the official Zalo Bot webhook (`InputProcessorService`) keep the global rule only.

## Config (`ThreadBotConfig.memberAccess`, column `zca_thread_configs.member_access` jsonb)

| Field | Default | Meaning |
| --- | --- | --- |
| `mode` | `granted-users` | `granted-users`: global rule only (behavior before this feature). `all-members`: every sender in the group. `selected-members`: only `memberIds` |
| `memberIds` | `[]` | ZCA UIDs (`message.data.uidFrom`, = `users.id`) granted in this thread; kept when the mode changes |

- `normalizeMemberAccessConfig` (`@zalobot/contracts`): unknown mode → `granted-users`; ids trimmed strings, de-duplicated, max `MEMBER_ACCESS_LIMITS.MAX_MEMBERS` (1000). Applied on every read (DB, Redis, legacy JSON), on `updateConfig` (merge then normalize) and in the web form.
- Migration `1724900000000-AddMemberAccessToZcaThreadConfigs` adds the column with the default, so existing threads keep the global rule.

## Backend (strategy per thread kind, `apps/api/src/zca/access/`)

- `ThreadAccessPolicy.allows(senderId, config)`: does this thread grant access on its own?
  - `GroupMemberAccessPolicy`: switch on `memberAccess.mode`.
  - `PersonalAccessPolicy`: always false.
- `ThreadAccessService.grantsThreadAccess(senderId, config, kind)`: picks the policy from `Record<'group' | 'user', ThreadAccessPolicy>`. `kind` comes from the zca-js message type (`ThreadType.Group`), not `config.threadType` (older rows may say `user` for numeric group ids). Empty sender → false. Policies are pure; the service has no DI dependencies, so `ZcaBotFeatureService` falls back to `new ThreadAccessService()` when it is not injected.
- Why not a Nest Guard/Pipe/Interceptor: ZCA messages arrive through the zca-js WebSocket callback (`onMessage(message, api)`), outside Nest's request pipeline, so `@UseGuards` never runs. The existing "guards" are plain classes called by hand.
- `GrantAccessGuard.canActivate(input, { threadGrant? })` order: admin → `registerPendingUser` (DENIED row if new) → `threadGrant` → global `isGrantAccess` → denial reply with the User ID. A thread-granted sender is still registered (creator names resolve) but does not gain global access.

### Single access check in `onMessage`

After the trigger is resolved (`isDirectTriggered`: mention, bot-name regex, prefix, or 1-1 text):

1. Not triggered → return (backup, chat memory and the pending fast-path already ran above).
2. `checkDirectGuardsAndCooldown({ ..., config, accessKind })` once: bot account bypass → `InitialAdminBootstrapGuard` → `GrantAccessGuard` with `threadGrant` → cooldown.
3. Branches (`1`/`2` hint, quoted media, captioned image, video, text) run without their own checks.

Consequences: the `1`/`2` hint now needs access; a non-granted sender who triggers the bot with an image whose URL cannot be resolved gets the denial reply instead of silence. Reactions and `yes/cancel <code>` stay collective (no access check); `edit <code>` keeps its own gate (`canEditPending`).

## Group member list

- `ZcaService.getGroupMembers(groupId, forceRefresh)`: `api.getGroupInfo(groupId)` → `gridInfoMap[groupId].memVerList` (`<uid>_<ver>`, suffix stripped, de-duplicated) + `totalMember`; `api.getGroupMembersInfo` in batches of 50 → `profiles` (`displayName`, `zaloName`, `avatar`). A failed batch logs a warning and its members are listed by UID. Result cached in Redis `zca:group_members:<groupId>` for 600 s; `forceRefresh` skips the cache. Returns null when ZCA is logged out or the group is missing. Pure parsing in `zca-group-members.ts` (tested).
- `GET /api/zca/threads/:threadId/members?refresh=true` (admin) → `IZcaGroupMembersResponse { members: IZcaGroupMember[], totalMembers, fetchedAt }`; 400 when ZCA is not logged in, 404 when Zalo does not return the group. Route constant `API_ROUTES.zcaThreadMembers(threadId)`.

## Web UI (`/zca/thread?id=<groupId>`)

- `MemberAccessSection` (groups only, left column under "Tương tác Bot trực tiếp"): title "Ai được gọi bot trong nhóm", note that admins and globally granted users are always allowed, three radio cards (one per `THREAD_MEMBER_ACCESS_MODES` entry, label + hint). Saved with the page's Save button (`formToPayload` sends normalized `memberAccess`).
- `GroupMemberPicker` (mode `selected-members`): `useZcaThreadMembersQuery` (key `zcaQueryKeys.members(threadId)`, stale 5 min) joined with `useUsersQuery`.
  - Search (name, Zalo name, UID; diacritics ignored), filter chips All / Selected, "Selected N/M", "Refresh list" (`useRefreshZcaThreadMembersMutation`, `refresh=true`, writes the query cache).
  - Rows: avatar, name, Zalo name, UID, badges Admin / Global access / No longer in the group. Admins and globally granted users show "Always allowed" instead of a switch; others get an emerald `ConfigSwitch`.
  - Selected UIDs no longer returned by Zalo stay listed (badge "No longer in the group") so the admin can remove them.
  - States: loading text, error with Retry, empty ("No matching members"), list (max 420 px, scrolls). Rows ≥ 48 px; chips and inputs use `TAP_CONTROL` / `TAP_INPUT` at phone width; radius stays `rounded-[3px]`.
- Pure logic `model/group-members.ts` (tested): `buildGroupMemberRows`, `filterGroupMemberRows`, `setMemberSelected`. All text via i18n keys `zca.memberAccess.*` (vi + en).

## Out of scope

- Per-chat access for 1-1 chats or the official webhook.
- Auto-removing `memberIds` when a member leaves the group (only the badge).
- Per-thread cooldown.
