# Reminders Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/reminders/README.md)

## Purpose

Scheduled reminders delivered as a Zalo message, by default to the owner's private chat, or to a chosen group with chosen people (see [Reminder targets](#reminder-targets)). Reminders are created from chat (LLM tool `SET_REMINDER`, confirmation-gated) or from the dashboard, listed/edited there, and fired by a BullMQ background job. A reminder belongs to its creator (`user_id`): `/reminders` lists only the user's own.

## Reminder times

A reminder (like a task, see [`tasks/README.md`](../tasks/README.md#task-reminders)) reminds at **one or more times**, max `REMINDER_TIME_LIMITS.MAX_TIMES` = 10: rows of `reminder_times` (`id`, `reminder_id` → cascade, `remind_at`, `sent_at`; `timestamp` without time zone like `reminders.remind_at`, so migrated values read back unchanged; index `(sent_at, remind_at)`). Migration `1724940000000-CreateReminderTimes` copied each existing reminder into one row (`sent_at` = `completed_at` for triggered ones). `reminders.remind_at` is the next time not sent (a summary, so lists, the Home payload and `/reminders` in chat keep sorting by it).

- Shared pure logic `reminder-times.ts`: `planReminderTimes(current, requested, now, { allowPast })` (keep times already saved with their sent flag, remove the rest, add new; max 10), `nextPendingReminderAt`, `lastSentReminderAt`, `nextRepeatAt`, `toReminderTimeItems`, `requestedReminderTimes` (API `remindTimes` wins over the single legacy `remindAt`).
- Personal reminders pass `allowPast: true`: the server never refused a past time (it goes out on the next tick); the dashboard form checks it. Task reminders do refuse new past times.
- Repeat (`daily`/`weekly`) applies to **each** time: "uống thuốc 8h và 20h, hằng ngày" moves each time forward after it goes out.
- Snooze moves the **next** time not sent: API `snoozeReminder` (+N minutes from now, unused by routes); the dashboard Snooze button PATCHes `remindTimes` with that time + 15 minutes (`snoozeReminderTimes`).
- Editing `remindTimes` keeps saved times (and their sent flag); at least one time is required (400 otherwise).

## Reminder targets

Shared by personal reminders and task reminders ([`tasks/README.md`](../tasks/README.md#task-reminders)) so the "where and who" is built once. A target is `{ chatId, users: [{ id, name }], mode }` (`apps/api/src/reminders/reminder-target.ts`).

- `chatId`: a Zalo group or private chat. Default: personal reminder → the owner's private chat; task reminder → the chat the bot was asked in. `hasZaloAccount` is false for `dashboard-owner` and for a legacy official-bot id (20 hex chars with a letter, `isLegacyZaloBotId`, `users/legacy-zalo-bot-id.ts`): such users have no private chat (no `isSelf` channel) and must pick one ⇒ else 400 `Chọn kênh Zalo nhận nhắc.`
- A newly chosen chat must be the actor's own private chat, the chat the bot was asked in, or a listened thread (`zca_thread_configs.is_listened`) ⇒ else 400.
- `users`: people of that **group** to remind, max `REMINDER_TARGET_LIMITS.MAX_USERS` = 10, stored with their tag name. Dashboard picks are validated against the group's member list (`ZcaService.getGroupMembers`, cached; ZCA logged out ⇒ 400); bot tags are taken from the message's real Zalo mentions, never guessed from names. A private chat has no people; moving to another chat drops them.
- `mode` (`ReminderTargetMode`): `mention` (default) = one message in the group tagging the people; `direct` = a private message to each (`reminderTarget.directIntro`: "You are reminded in <chat>"), and whoever cannot be messaged privately (often: not a Zalo friend of the bot account) is tagged in one fallback group message. Without people the mode is always `mention`.
- Changing the chat, the set of people or the mode **never re-sends** a time that already went out; it only applies to times not sent yet.
- Delivery skips (and logs, no retry) a group the admin stopped listening to, the `dashboard-owner` pseudo-chat and a legacy official-bot id (ZCA cannot message it; older rows with `chat_id` NULL of a legacy-id owner land here). Fix such rows by merging the legacy user into the ZCA uid (users module, which also moves `chat_id`) or by picking a chat.

Code: `ReminderTargetService` (`reminder-target.service.ts`, exported by `RemindersModule`): `listChannels`, `listMembers`, `chatNames`, `isListenedThread`, `isUnlistenedGroup`, `resolve(input, current, actor, 'origin' | 'self')`, `deliver(target, { header, body }, locale)`. Pure helpers in `reminder-target.ts`: `buildReminderMessage` (tag line between header and body, `pos`/`len` in UTF-16 units as `zca-js` expects), `normalizeTargetUsers`, `parseTargetUsers` (Redis JSON), `isSameTarget`, `isReminderTargetMode`. `ZcaMessengerService.sendMessageWithMentions` sends one tagged message (not chunked; over the chunk length it goes out untagged).

HTTP (`ReminderTargetsController`, `@Controller('reminder-targets')`, any signed-in dashboard user):

| Method | Route (`API_ROUTES`) | Behavior |
| --- | --- | --- |
| GET | `reminderTargetChannels` | the user's private chat (`isSelf`, Zalo users only) then every listened thread |
| GET | `reminderTargetMembers(chatId)` | members of a listened group (`[{ id, name }]`); 400 for other chats or when ZCA is logged out |

Any dashboard user thereby sees the names of listened threads and their members (before, only admins saw members).

## Code ownership

- `apps/web/src/modules/reminders` contains `api/` and `model/`:
  - `reminders-api.ts`: `getReminders`, `createReminder` (`POST`), `updateReminder`, `deleteReminder` → `API_ROUTES.reminders` (`/api/reminders`, `/api/reminders/:id`).
  - `reminders-query.ts`: `remindersQueryKeys.list()` (`['reminders']`), `useRemindersQuery`, `useCreateReminderMutation`, `useUpdateReminderMutation`, `useDeleteReminderMutation`. Mutations invalidate `['reminders']` and `['dashboard']`.
  - `model/reminder-create-form.ts` (pure, unit-tested): `REMINDER_NOTIFY_TYPES`, `REMINDER_REPEAT_TYPES`, `createReminderDraft` (default now + 1h, `text`, `none`, empty target), `buildCreateReminderRequest(draft, now, channels)` (errors `titleRequired` | `remindAtRequired` | `pastTime` | `channelRequired` | `callPrivateOnly`; the current minute still counts as valid; until channels load the target is left to the API default).
  - `reminder-targets-api.ts` / `reminder-targets-query.ts`: `getReminderTargetChannels`, `getReminderTargetMembers`, `reminderApiErrorMessage` (API `message` of a rejected save); `reminderTargetsQueryKeys`, `useReminderTargetChannelsQuery(enabled)`, `useReminderTargetMembersQuery(chatId, enabled)` (60 s stale, no retry). Also used by the tasks screens.
  - `model/reminder-target.ts` (pure, unit-tested): `ReminderTargetDraft` (`chatId` empty = default), `buildReminderTargetFields(draft, channels, fallbackChatId)`, `draftChatId`, `selfChannelId`, `isGroupChannel`, `toggleTargetUser` (max 10), `isTargetChanged`, `reminderTargetDraftFrom`.
- The screen lives in the dashboard module: `RemindersScreen` (`apps/web/src/modules/dashboard/presentation/components/reminders-screen.tsx`, re-exported by `dashboard/view/reminders-screen.tsx`, routed by `apps/web/app/(private)/reminders/page.tsx`) `RemindersTable` (`reminders-table.tsx`) and `CreateReminderDialog` (`create-reminder-dialog.tsx`, on the shared `FormDialog`), same folder. Shared target UI in the same folder: `ReminderTargetFields` (`reminder-target-fields.tsx`: Send reminder to → Who to remind (group only: searchable checkbox list of members, max 10) → How to remind (with people); dialog or `compact` table-cell layout; exports `INLINE_EDIT_FIELD`) and `ReminderTargetSummary` (`reminder-target-summary.tsx`: `chat · 👤 names · Private message`).
- Backend: `apps/api/src/reminders` (`RemindersController`, `RemindersService`, `ReminderSchedulerService`, `ReminderTargetService`, `ReminderTargetsController`), entity `ReminderEntity` (`apps/api/src/database/entities/reminder.entity.ts`); migration `1724930000000-AddReminderTargets` added `chat_id` (NULL = owner's private chat, so older rows behave as before), `remind_users` (jsonb, default `[]`), `remind_mode` (default `mention`).

## Web UI (`RemindersScreen`)

- Data source: `useRemindersQuery`; when it returns an empty list, falls back to `dashboard.data.reminders` (`useDashboardQuery`).
- `DataPanel` with row counter and client search by title.
- Create: `+ Add reminder` toolbar button (desktop, `max-[960px]:hidden`) / `MobileActionBar` (compact) opens `CreateReminderDialog` with title, reminder times (`ReminderTimesField`, one or more `datetime-local`, local time → ISO, sent as `remindTimes`), notify type, repeat type and the target (`ReminderTargetFields`; private chat preselected; `dashboard-owner` must pick). `Call` is disabled unless the target is the user's own private chat (`reminders.notifyType.callPrivateOnly`). Save is disabled while invalid or in the past; validity is re-checked against the clock on submit. API errors stay in the dialog; success closes it with a toast.
- Columns: title, notify type (`text` / `call`), schedule (`remindAt`), repeat (`none` / `daily` / `weekly`), `target` (Sent to, `showTarget`, this page only: `ReminderTargetSummary`, `chatName` else "My private chat"), actions.
- Inline edit (title, `remindAt` datetime, notify type, repeat type, target via compact `ReminderTargetFields`) with Save/Cancel; target fields are sent only when changed (`isTargetChanged`); API rejections show their message in a toast; Snooze = PATCH `remindAt` + 15 minutes; Delete asks `window.confirm`. Toasts on save/snooze/delete.
- Error state: alert strip with Retry (invalidates reminders + dashboard caches). Loading is passed to the table.

## Backend API (`RemindersController`, `@Controller('reminders')`)

All endpoints are scoped to the dashboard user (`getDashboardUserId`).

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/reminders` | `getUserUpcomingReminders`: rows with `isTriggered = false`, ordered by `remindAt` ASC, plus `chatName` (`ReminderTargetService.chatNames`) and `remindTimes` (earliest first) |
| GET | `/api/reminders/:id` | One reminder of the user, 404 otherwise |
| POST | `/api/reminders` | Requires `title` and `remindTimes` (≤10 ISO) or a single `remindAt`; optional `notifyType` (`text`/`call`), `repeatType` (`none`/`daily`/`weekly`), `chatId`, `remindUserIds`, `remindMode` |
| PATCH | `/api/reminders/:id` | Updates `title`, `remindTimes` (or legacy `remindAt` = one time), `notifyType`, `repeatType`, target fields. New times put a finished reminder back to pending; a target change alone does not |
| DELETE | `/api/reminders/:id` | Returns `{ deleted: true }`, 404 if not found |

Contracts: `IReminderListItem` (+ `chatId?`, `chatName?`, `remindUsers?`, `remindMode?`), `ICreateReminderRequest`, `IUpdateReminderRequest` (+ `chatId?`, `remindUserIds?`, `remindMode?`) (`@zalobot/contracts`). The controller ignores `status`/`snoozeCount`/`snoozedUntil` from the request body. `notifyType: 'call'` with a target other than the owner's private chat ⇒ 400.

## Scheduler (`ReminderSchedulerService`)

- BullMQ queue `reminders` (`reminder.queue.ts`), worker `ReminderProcessor` (concurrency 1), logic in `ReminderSchedulerService`; queue mechanics (scan every 30 s, retries, Redis requirement): global/backend-runtime-services.md.
- Job `scan` (`scanDueReminders`): `getDueReminders(now)` = `reminder_times` rows with `sent_at IS NULL`, `remind_at <= now`, of reminders with `is_triggered = false`; oldest first, 50 per scan.
- The scan is skipped while ZCA is logged out (`ZcaMessengerService.isConnected()`), so reminders wait for the next login instead of being marked sent without going out.
- For each due time: `claimReminderTime` (conditional update matching `id`, `sent_at IS NULL` and the `remind_at` as read: one-off ⇒ `sent_at = now`; `daily`/`weekly` ⇒ `remind_at` moves to the next occurrence after now via `nextRepeatAt`, so a missed day is not sent twice); only the claimer queues job `deliver` `{ timeId, remindAt: <occurrence that fired> }` with `jobId = reminder-time-<timeId>-<remindAt ms>` (a repeating reminder reuses its time row, so the occurrence is part of the id), then `refreshReminderSummary`. If queueing fails, `releaseReminderTime(timeId, firedAt)` (`sent_at = NULL`, `remind_at = firedAt`) so the next scan retries it.
- Job `deliver` (`deliverReminder`): re-reads the time (`getReminderTime`); reminder deleted ⇒ `skipped`. ZCA logged out since the scan ⇒ release the time + `refreshReminderSummary` (`released`) so the first scan after login re-queues it. Else format the fired occurrence in `Asia/Ho_Chi_Minh` with the user's `preferredLocale`, send `reminder.header.text` + title + time via `ReminderTargetService.deliver(reminderTarget(row), …)` (target = `chat_id` or the owner's private chat; people tagged or messaged privately per mode). `failed` ⇒ BullMQ retries (5 attempts, backoff from 30 s). Rows created by `dashboard-owner` before reminder targets point at `dashboard-owner` and are skipped (they never reached anyone before either).
- `refreshReminderSummary`: `reminders.remind_at` = the next time not sent; with none left (one-off reminders only) ⇒ `isTriggered=true`, `status='completed'`, `completedAt`. Repeating reminders never run out of times.
- Known gap: `notifyType = 'call'` is stored and displayed, but the scheduler always sends a text message (no call path; `reminder.header.call` is unused).

## Chat creation & confirmation

- `SET_REMINDER` is an LLM tool (`ZALO_TOOL_DEFINITIONS`); in ZCA groups it is reachable only from messages that mention the bot or use a thread prefix.
- Target from chat (`SetReminderToolStrategy`): stays the sender's private chat unless the message tags people (`AgentInput.taggedUsers`, from `extractTaggedUsers` in `zca-bot-feature.service.ts`: Zalo mentions minus the bot and `@All`) or the LLM sets `remindInGroup` ("nhắc cả nhóm"); then `chatId` = this chat, people = the tagged ones (+ the sender with `remindSelf`), `remindMode: 'direct'` for "nhắn riêng". The payload also carries `originChatId` (trusted chat). The card shows `Gửi tới`, `Nhắc ai`, `Cách nhắc`; the summary adds `👤 @A, @B (nhắn riêng)`. Editing a pending reminder (`edit <code>`) re-runs the tool on the edit text, which carries no tags, so its people are dropped.
- The pending action is stored in Redis as JSON; on confirm, `parseReminderPayload` (`apps/api/src/zca/confirmation/transaction-confirmation.service.ts`) revives `remindAt` from ISO string into a `Date` (`toValidReminderDate` in `reminders.service.ts`) and the target fields (`parseTargetUsers`) before `RemindersService.createReminder`.
- Fast-path `/reminders` (`RemindersQuickToolStrategy`) lists upcoming reminders in chat.
