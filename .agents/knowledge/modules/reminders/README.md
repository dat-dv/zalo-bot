# Reminders Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/reminders/README.md)

## Purpose

Scheduled reminders delivered as a Zalo message, by default to the owner's private chat, or to a chosen group with chosen people (see [Reminder targets](#reminder-targets)). Reminders are created from chat (LLM tool `SET_REMINDER`, confirmation-gated) or from the dashboard, listed/edited there, and fired by a backend cron. A reminder belongs to its creator (`user_id`): `/reminders` lists only the user's own.

## Reminder targets

Shared by personal reminders and task reminders ([`tasks/README.md`](../tasks/README.md#task-reminders)) so the "where and who" is built once. A target is `{ chatId, users: [{ id, name }], mode }` (`apps/api/src/reminders/reminder-target.ts`).

- `chatId`: a Zalo group or private chat. Default: personal reminder → the owner's private chat; task reminder → the chat the bot was asked in. `dashboard-owner` (no Zalo account) has no private chat and must pick one.
- A newly chosen chat must be the actor's own private chat, the chat the bot was asked in, or a listened thread (`zca_thread_configs.is_listened`) ⇒ else 400.
- `users`: people of that **group** to remind, max `REMINDER_TARGET_LIMITS.MAX_USERS` = 10, stored with their tag name. Dashboard picks are validated against the group's member list (`ZcaService.getGroupMembers`, cached; ZCA logged out ⇒ 400); bot tags are taken from the message's real Zalo mentions, never guessed from names. A private chat has no people; moving to another chat drops them.
- `mode` (`ReminderTargetMode`): `mention` (default) = one message in the group tagging the people; `direct` = a private message to each (`reminderTarget.directIntro`: "You are reminded in <chat>"), and whoever cannot be messaged privately (often: not a Zalo friend of the bot account) is tagged in one fallback group message. Without people the mode is always `mention`.
- Changing the chat, the set of people or the mode re-arms a reminder that already went out.
- Delivery skips (and logs) a group the admin stopped listening to and the `dashboard-owner` pseudo-chat.

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
- Create: `+ Add reminder` toolbar button (desktop, `max-[960px]:hidden`) / `MobileActionBar` (compact) opens `CreateReminderDialog` with title, `remindAt` (`datetime-local`, local time → ISO), notify type, repeat type and the target (`ReminderTargetFields`; private chat preselected; `dashboard-owner` must pick). `Call` is disabled unless the target is the user's own private chat (`reminders.notifyType.callPrivateOnly`). Save is disabled while invalid or in the past; validity is re-checked against the clock on submit. API errors stay in the dialog; success closes it with a toast.
- Columns: title, notify type (`text` / `call`), schedule (`remindAt`), repeat (`none` / `daily` / `weekly`), `target` (Sent to, `showTarget`, this page only: `ReminderTargetSummary`, `chatName` else "My private chat"), actions.
- Inline edit (title, `remindAt` datetime, notify type, repeat type, target via compact `ReminderTargetFields`) with Save/Cancel; target fields are sent only when changed (`isTargetChanged`); API rejections show their message in a toast; Snooze = PATCH `remindAt` + 15 minutes; Delete asks `window.confirm`. Toasts on save/snooze/delete.
- Error state: alert strip with Retry (invalidates reminders + dashboard caches). Loading is passed to the table.

## Backend API (`RemindersController`, `@Controller('reminders')`)

All endpoints are scoped to the dashboard user (`getDashboardUserId`).

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/reminders` | `getUserUpcomingReminders`: rows with `isTriggered = false`, ordered by `remindAt` ASC, plus `chatName` (`ReminderTargetService.chatNames`) |
| GET | `/api/reminders/:id` | One reminder of the user, 404 otherwise |
| POST | `/api/reminders` | Requires `title`, valid `remindAt`; optional `notifyType` (`text`/`call`), `repeatType` (`none`/`daily`/`weekly`), `chatId`, `remindUserIds`, `remindMode` |
| PATCH | `/api/reminders/:id` | Updates `title`, `remindAt`, `notifyType`, `repeatType`, target fields. Changing `remindAt` or the target resets `isTriggered=false`, `status='pending'` |
| DELETE | `/api/reminders/:id` | Returns `{ deleted: true }`, 404 if not found |

Contracts: `IReminderListItem` (+ `chatId?`, `chatName?`, `remindUsers?`, `remindMode?`), `ICreateReminderRequest`, `IUpdateReminderRequest` (+ `chatId?`, `remindUserIds?`, `remindMode?`) (`@zalobot/contracts`). The controller ignores `status`/`snoozeCount`/`snoozedUntil` from the request body. `notifyType: 'call'` with a target other than the owner's private chat ⇒ 400.

## Scheduler (`ReminderSchedulerService`)

- `@Cron(CronExpression.EVERY_30_SECONDS)`: `getDueReminders()` = `remindAt <= now` and `isTriggered = false`.
- The tick is skipped while ZCA is logged out (`ZcaMessengerService.isConnected()`), so reminders wait for the next login instead of being marked sent without going out (before, they were lost).
- For each due reminder: format time in `Asia/Ho_Chi_Minh` with the user's `preferredLocale`, send `reminder.header.text` + title + time via `ReminderTargetService.deliver(reminderTarget(row), …)` (target = `chat_id` or the owner's private chat; people tagged or messaged privately per mode), then `markTriggered`. Rows created by `dashboard-owner` before reminder targets point at `dashboard-owner` and are skipped (they never reached anyone before either).
- `markTriggered`: `daily` → `remindAt + 24h`, `weekly` → `remindAt + 7d` (stays pending); `none` → `isTriggered=true`, `status='completed'`, `completedAt`.
- Known gap: `notifyType = 'call'` is stored and displayed, but the scheduler always sends a text message (no call path; `reminder.header.call` is unused).

## Chat creation & confirmation

- `SET_REMINDER` is an LLM tool (`ZALO_TOOL_DEFINITIONS`); in ZCA groups it is reachable only from messages that mention the bot or use a thread prefix.
- Target from chat (`SetReminderToolStrategy`): stays the sender's private chat unless the message tags people (`AgentInput.taggedUsers`, from `extractTaggedUsers` in `zca-bot-feature.service.ts`: Zalo mentions minus the bot and `@All`) or the LLM sets `remindInGroup` ("nhắc cả nhóm"); then `chatId` = this chat, people = the tagged ones (+ the sender with `remindSelf`), `remindMode: 'direct'` for "nhắn riêng". The payload also carries `originChatId` (trusted chat). The card shows `Gửi tới`, `Nhắc ai`, `Cách nhắc`; the summary adds `👤 @A, @B (nhắn riêng)`. Editing a pending reminder (`edit <code>`) re-runs the tool on the edit text, which carries no tags, so its people are dropped.
- The pending action is stored in Redis as JSON; on confirm, `parseReminderPayload` (`apps/api/src/zca/confirmation/transaction-confirmation.service.ts`) revives `remindAt` from ISO string into a `Date` (`toValidReminderDate` in `reminders.service.ts`) and the target fields (`parseTargetUsers`) before `RemindersService.createReminder`.
- Fast-path `/reminders` (`RemindersQuickToolStrategy`) lists upcoming reminders in chat.
