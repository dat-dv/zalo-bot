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
- Order: `InitialAdminBootstrapGuard` (first user becomes admin, only while no admin/granted user exists) -> `GrantAccessGuard` (admin or granted users only) -> cooldown `UsersService.checkCooldown` (2 s per user, in-memory, admins exempt) -> `TextInputService`. Reactions go to `TransactionConfirmationService.handleReaction`.
- Outgoing text goes through `ZcaMessengerService` (ZCA only; replies over 1900 chars are split, 300 ms apart; typing indicator = ZCA `sendTypingEvent`). With ZCA logged out, sends fail softly and the dashboard is reached with `DASHBOARD_LOGIN_CODE` (see [Dashboard Session](dashboard-session.md)).

## TextInputService order

1. Clean bot mention / trigger prefix.
2. Pending confirmation commands (`TransactionConfirmationService.handleCommand`, in `apps/api/src/zca/confirmation/`): `yes|y|ok|xác nhận [code]`, `cancel|no|hủy|bỏ qua [code]`, `yes all` / `cancel all`, `edit|sửa <code> <instruction>`.
3. Pending image choices (`1`, `2`, `hủy`) via `PendingImageActionDispatcher`; a lone `1`/`2` with nothing pending gets a hint.
4. Fast-path commands (`TextToolFactory.resolveFastPathToolType`).
5. LLM tool calling (`LlmService`, see [LLM Providers](llm-providers.md)); no tool -> conversation reply unless `allowAiChat === false`. When free chat is allowed (`allowAiChat !== false`, `undefined` = on), the tool prompt gets `CHIT_CHAT_INSTRUCTION` (answer general questions, never refuse as "only a finance assistant", flag possibly stale real-time info) and a no-tool reply triggers a second tool-free `generate` (`generateChitChatReply`); its text is sent, falling back to the first-pass text when empty or failed. Not applied to `edit <code>` or the LLM-error fallback.

## Fast-path commands

Match = exact command or command followed by a space, unless noted. Admin = handler checks `UsersService.isAdmin`.

| Command / aliases | Tool type | Behavior |
| --- | --- | --- |
| `/start`, `start` | `START` | Welcome message (admin badge). |
| `/help`, `help`, `trợ giúp`, `tro giup`, `hướng dẫn`, `huong dan` | `HELP` | Help text. |
| `/echo…` (prefix) | `ECHO` | Echoes text. |
| `/ping` | `PING` | Liveness reply. |
| `/reset`, `/clear` | `RESET` | Reply only; no stored context exists. |
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
| `/dashboard`, `dashboard…`, `mở dashboard…`, `xem dashboard…` | `DASHBOARD` | One-time `/api/access?token=` link + 8-char code (20 min). |
| `/users` | `USERS` | Admin. User list with role and Google status. |
| `/ban…` (prefix) | `BAN` | Admin. Queues `BAN_USER` confirmation; admins cannot be banned. |
| `/drive`, `/storage`, `/kho`, `/folder`, `/album` (prefix) | `GET_STORAGE_LINKS` | Drive folder / Photos album links. |
| `/share`, `/share-drive`, `/sharedrive`, `share <email>` | `SHARE_DRIVE` | Share the chat's Drive partition (`reader`) with an email. |

## Confirmation

Sensitive mutations from LLM tools and `/ban` create a pending action (3-digit code, 5-minute TTL, memory + Redis). Resolution and message recall: see [Zalo Response Layout](zalo-response-layout.md).

## Tests

`npm run test --workspace @zalobot/api` runs every `apps/api/src/**/*.spec.ts`.
