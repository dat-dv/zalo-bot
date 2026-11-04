# Recurring (Fixed income and expenses)

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/recurring/README.md)

## Purpose

Rent, bills and salary repeat every period. A rule produces one occurrence per period so nobody has to remember or retype them. Part of the shared ledger: every signed-in user sees and manages all rules.

## Data

- `recurring_transactions`: type, amount (nullable), category, note, place, repeat, `anchor_at`, `next_due_at`, `mode`, `notify_chat_id`, `is_active`, creator.
- `recurring_occurrences`: one per period, `status` `due | recorded | skipped`, unique `(rule_id, due_at)`, `transaction_id`, `notified_at`.
- Occurrences are stored, not derived: a `due` one may wait for days, far past the 5-minute life of a pending card.

## Modes

- `auto`: fixed amount required. At the due time the transaction is written with `source: 'system'`, the audit actor is system, and the creator is the rule's creator. Wrong rows are deleted or edited like any other.
- `confirm`: amount optional (expected value). The period stays `due` with no expiry until someone records or skips it, on `/recurring` or in chat through `CONFIRM_RECURRING` (a normal pending card). The transaction credits whoever recorded it.

## Rules

- Scan job (`RecurringScanProcessor`, queue `recurring-transactions`) every 5 minutes. Recording does not need Zalo; notices wait until ZCA is connected and retry on later scans.
- Repeat logic reuses `reminder-schedule.ts` (Vietnam time, monthly clamps to the last day, the anchor keeps a 31st on the 31st). `none` is refused: a one-off is a normal transaction.
- A start in the past begins at the next period.
- Periods missed while the server was down are created and recorded (unlike reminders, this is money that moved), up to 60 per rule per scan.
- A paused rule creates nothing, and resuming does not bill the paused periods.
- The rule row is locked with `skip_locked` per scan and the unique key stops duplicates. Recording locks the occurrence, so a double click or a Zalo and web race records once.
- Changing a rule never rewrites existing occurrences. Deleting it removes its occurrences; recorded transactions stay.
- `notify_chat_id` must be a listened chat. Empty means no Zalo message.
- User merge moves `created_by_user_id`.

## API

`API_ROUTES.recurring` (`GET`, `POST`), `recurringDetail(id)` (`PATCH`, `DELETE`), `recurringOccurrenceRecord(id)`, `recurringOccurrenceSkip(id)`. Any signed-in dashboard user.

## Web UI (`APP_ROUTES.recurring`, `RecurringScreen`)

- "Waiting to be recorded" panel, shown only when something waits: name, date, amount input, Record, Skip. Record stays disabled without an amount.
- Rule list: name, category, repeat, mode, next period, chat, amount through `useMoneyVisibility`, with Edit, Pause or Resume, Delete. Rows stack on phones and buttons meet the phone tap size.
- Form in `FormDialog`: amount is required only in `auto`. An untouched date is not sent on edit, so the anchor stays.
- Loading, error, empty and data states are all handled.

## Limits

- Rules are created on the dashboard only, not from chat.
- Weekly rules on the dashboard use the weekday of the first period; picking several weekdays is API-only.
