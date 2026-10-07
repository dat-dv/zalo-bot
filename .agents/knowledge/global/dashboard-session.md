# Dashboard Session and Pages

The zalo dashboard link uses a random one-time exchange token. Only its SHA-256 hash is persisted in `dashboard_exchange_tokens`; the raw token appears only in the short-lived URL.

The shared zalo menu catalog drives command suggestions plus the `/start` and `/help` inline menu. It exposes **Dashboard** as a direct URL, placed in compact two-control rows with the remaining quick actions. `/dashboard` and exact short Dashboard requests are routed directly to the same URL instead of the generative model. Dashboard-link generation is optional: if exchange-token creation fails, the command still replies and omits only this button. The legacy callback remains only for already-sent menus and issues a new URL before replying.

- `GET /api/access?token=...` atomically consumes a valid, unused exchange token and redirects to root `/` with an access token in the URL fragment (`/#dashboard_token=...`).
- Access tokens expire after 24 hours. Refresh tokens expire after 7 days, rotate on refresh, and are stored only in an HTTP-only cookie.
- `GET /api/contacts` authenticates from the access token and returns at most 200 `debt_contacts` belonging to that token's user. No contact mutation is exposed through the web app.
- The web app groups private pages under `app/(private)/` with routes: Overview (`/`), Transactions (`/transactions`), Debts (`/debts`), Analytics (`/analytics`), Calendar (`/calendar`), Tasks (`/tasks`), Reminders (`/reminders`), and Contacts (`/contacts`). All use the shared dashboard session and `DataTable` primitive.
