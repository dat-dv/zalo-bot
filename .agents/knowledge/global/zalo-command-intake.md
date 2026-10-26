---
metadata:
  agent-artifact:
    id: global-zalo-command-intake-knowledge
    type: documentation
    depends_on:
      - apps/api/src/main.ts
      - apps/api/src/zca/zca-messenger.service.ts
      - apps/api/src/users/users.service.ts
      - apps/api/src/zca/text/text-input.service.ts
      - apps/api/src/zca/text/text-system-prompt.ts
      - apps/api/src/zca/text/text-tool.definitions.ts
      - apps/api/src/zca/text/intent-eval/intent-eval.cases.ts
      - apps/api/src/zca/text/intent-eval/intent-eval.ts
      - apps/api/scripts/eval-intent.ts
      - apps/api/src/zca/text/amend-pending.tool.ts
      - apps/api/src/zca/text/pending-edit-args.util.ts
      - apps/api/src/zca/text/text-tool.factory.ts
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
      - apps/api/src/zca/zca-bot-feature.service.ts
---

# Zalo Command Intake

Human guide: [Zalo Command Intake](../../docs/global/zalo-command-intake.md).

## Channel

The bot has one channel: the bot's **personal Zalo account (ZCA, `zca-js`)** — `ZcaService` / `ZcaBotFeatureService`. The official Zalo Bot Platform webhook (`/webhook`, `ZALO_BOT_TOKEN`) was removed (duplicate of ZCA); the chat pipeline lives in `apps/api/src/zca/`.

- QR login on the dashboard `/zca` page or `/zlogin` (admin). Per-thread config `zca_thread_configs`; direct-interaction defaults `enabled: false`, `triggerPrefixes: []`.
- Group messages reach the AI only with an @mention or a thread prefix; 1-1 text always does; media without text is only backed up.
- Access is checked once per addressed message: `InitialAdminBootstrapGuard` (first user becomes admin, only while no admin/granted user exists) -> `GrantAccessGuard` with a per-thread grant from `ThreadAccessService` (groups: `memberAccess` adds members on top of global access; see modules/zca/member-access.md) -> cooldown `UsersService.checkCooldown` (2 s per user, in-memory, admins exempt) -> `TextInputService`. Reactions go to `TransactionConfirmationService.handleReaction`.
- Outgoing text goes through `ZcaMessengerService` (ZCA only; replies over 1900 chars are split, 300 ms apart; typing indicator = ZCA `sendTypingEvent`, the only chat action ZCA has, via `sendTyping` / `startTyping` / `withTyping`, also wrapped around the receipt-image bill LLM call). With ZCA logged out, sends fail softly and the dashboard is reached with `DASHBOARD_LOGIN_CODE` (see [Dashboard Session](dashboard-session.md)).

## TextInputService order

1. Clean bot mention / trigger prefix.
2. Pending confirmation commands (`TransactionConfirmationService.handleCommand`, in `apps/api/src/zca/confirmation/`): `yes|y|ok|xác nhận [code]`, `cancel|no|hủy|bỏ qua [code]`, `yes all` / `cancel all`, `edit|sửa <code> <instruction>`. Edit rules (patch edit, people, old card kept on failure): see [Zalo Response Layout](zalo-response-layout.md).
3. Pending image choices (`1`, `2`, `hủy`) via `PendingImageActionDispatcher`; a lone `1`/`2` with nothing pending gets a hint.
4. Fast-path commands (`TextToolFactory.resolveFastPathToolType`).
5. LLM tool calling (`LlmService`, see [LLM Providers](llm-providers.md)); no tool -> conversation reply unless `allowAiChat === false`. When free chat is allowed (`allowAiChat !== false`, `undefined` = on), the tool prompt gets `CHIT_CHAT_INSTRUCTION` (answer general questions, never refuse as "only a finance assistant", flag possibly stale real-time info) and a no-tool reply triggers a second tool-free `generate` (`generateChitChatReply`); its text is sent, falling back to the first-pass text when empty or failed. Not applied to `edit <code>` or the LLM-error fallback. With tool calls, they run in order except `ASK_CLARIFICATION` (question about a missing detail), which runs last so it lands below the cards; it is sent regardless of `allowAiChat`.
   - Pending cards (`amend-pending.tool.ts`): when the sender has unexpired pending cards in this chat whose type has a text tool, the prompt gets `amendablePendingBlock` (code, type, title, args, people, and the rule "amend vs new request") and the tools get `AMEND_PENDING { code }` (not a `TextToolType`, no strategy). An `AMEND_PENDING` call (code, or the only card when the code is missing or wrong) runs `amendPending` with the whole message as the instruction; other tool calls of the amended type in that message are dropped, so a follow-up never yields a second card. Other types still run. A failed card lookup means no cards.

## Intent classification (tool prompt)

`buildToolSystemInstruction` (`text/text-system-prompt.ts`, pure, shared with the eval script) opens with `INTENT_CLASSIFICATION_RULES`: one ordered table, first match wins, plus contrasting pairs, because "nhớ" alone appears in all of them. No separate classifier LLM call (same model, double latency, compounding errors); the chosen tool is the label.

1. Reminder → `SET_REMINDER`: be told at a moment (a time, or "nhắc/báo/gọi dậy"); "7h tối nhớ mua sữa", "mai 9h họp".
2. Calendar → `CREATE_CALENDAR_EVENT`: only when a calendar entry is asked for ("thêm/đặt lịch …").
3. Task → `CREATE_TASK`: something to get done, at most a due day ("thêm việc…", "nhớ mua sữa"); `remindAt` only when a task is added and a reminder time is stated.
4. Note → `REMEMBER_NOTE`/`FORGET_MEMORY`: lasting fact about the bot or group, no time, no task ("mày là con mèo đen", "từ giờ xưng em", "Hằng ăn chay"); "X là Y" about the bot or a member counts even without "nhớ".
5. Chat → no tool: questions to the bot ("mày là con gì"), jokes, insults, passing orders ("cút lên mái nhà"); never a note.

Tool descriptions of these tools repeat the same boundaries.

Evaluation: `npm run eval:intent --workspace @zalobot/api` (`ENV_FILE=.env.production` to use the prod chain) sends each `INTENT_EVAL_CASES` message (≈40, incl. the real chats of 25–26/10/2026) to the real `LlmService` chain with the bot's prompt and tools, spaced 4 s (`EVAL_GAP_MS`) with 3 retries after 30 s on provider failure; prints right/wrong; exits 1 below 95% of answered cases. Sends no Zalo message, writes nothing. Run after any prompt or tool-description change.

## Fast-path commands

Match = exact command or command followed by a space, unless noted. Admin = handler checks `UsersService.isAdmin`.

| Command / aliases | Tool type | Behavior |
| --- | --- | --- |
| `/gioithieu`, `giới thiệu`, `gioi thieu` | `WELCOME` | Welcome message (admin badge). Telegram-era `/start` was removed; it now goes to the LLM like other text. |
| `/help`, `help`, `trợ giúp`, `tro giup`, `hướng dẫn`, `huong dan` | `HELP` | Help text. |
| `/echo…` (prefix) | `ECHO` | Echoes text. |
| `/ping` | `PING` | Liveness reply. |
| `/reset`, `/clear` | `RESET` | Reply only; no stored context exists. |
| `/sync` | `SYNC_MEMORY` | Sends this chat's past pending days and today's new messages to Cognee now (long-term memory on); the result is posted when done. See `modules/zca/chat-memory.md`. |
| `/zalo-login`, `/zca-login`, `/zlogin` | `ZALO_LOGIN` | Admin. Starts ZCA QR login. |
| `/zalo-logout`, `/zca-logout`, `/zlogout` | `ZALO_LOGOUT` | Admin. Logs ZCA out. |
| `/login`, `/auth` | `LOGIN` | Admin. Google OAuth link for the shared account. |
| `/status`, `/id`, `/myid` (prefix, case-insensitive) | `STATUS` | IDs, role, Google connection. |
| `/today`, `hôm nay` | `TODAY` | Today's calendar and open tasks (both from the DB), finance summary. |
| `/week`, `tuần này` | `WEEK` | Next 7 days of calendar and open tasks (DB, no Google needed). |
| `/finance`, `/thuchi`, `/money` | `FINANCE` | Today's income/expense summary. |
| `/debts`, `/debt`, `/congo` | `DEBTS` | Active debts. |
| `/tasks`, `/task`, `/viec` | `TASKS` | List open tasks (DB); `/task <title>` creates a task immediately (no confirmation). |
| `/reminders`, `/reminder`, `/nhacnho`, `/nhac` | `REMINDERS` | Upcoming reminders. |
| `/dashboard`, `dashboard…`, `mở dashboard…`, `xem dashboard…` | `DASHBOARD` | One-time `/api/access?token=` link + 8-digit code (20 min). |
| `/users` | `USERS` | Admin. User list with role and Google status. |
| `/ban…` (prefix) | `BAN` | Admin. Queues `BAN_USER` confirmation; admins cannot be banned. |
| `/drive`, `/storage`, `/kho`, `/folder`, `/album` (prefix) | `GET_STORAGE_LINKS` | Drive folder / Photos album links. |
| `/share`, `/share-drive`, `/sharedrive`, `share <email>` | `SHARE_DRIVE` | Share the chat's Drive partition (`reader`) with an email. |

## Confirmation

Sensitive mutations from LLM tools and `/ban` create a pending action (3-digit code, 5-minute TTL, memory + Redis). Resolution and message recall: see [Zalo Response Layout](zalo-response-layout.md).

## Tests

`npm run test --workspace @zalobot/api` runs every `apps/api/src/**/*.spec.ts`.
