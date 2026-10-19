---
metadata:
  agent-artifact:
    id: global-google-oauth-public-verification-knowledge
    type: documentation
    depends_on:
      - apps/api/src/google/google-auth.service.ts
      - apps/web/app/privacy/page.tsx
      - apps/web/app/about/page.tsx
      - apps/web/app/terms/page.tsx
      - packages/contracts/src/index.ts
---

# Public Google OAuth Verification

`GOOGLE_SCOPES` (`apps/api/src/google/google-auth.service.ts`) requests exactly:

- `openid`, `userinfo.email`, `userinfo.profile` — identify the connected account.
- `calendar` — read/create/update/delete events on user command.
- `tasks` — Google Tasks create/list/complete.
- `drive.file` — app-created Drive folders/files for channel partitions (`zalobot/<channelId>/<category>`) and folder sharing.
- `photoslibrary.appendonly` — create albums and upload bill/image/video media.

Each scope must map to an implemented user-facing action; do not pre-request Gmail, Sheets, Docs, Contacts, or other future capabilities. Consent uses `access_type: 'offline'` and `prompt: 'consent'`.

Public review surface: `/about`, `/privacy`, `/terms` (static pages in `apps/web/app/`). The privacy page must state Google data categories, purpose, retention/deletion contact, and the Google API Services User Data Policy Limited Use commitment. Published contact: `public.supportEmail` = `datdoan.dev@gmail.com`. Known gap: the privacy page scope list (`public.privacy.*Scope` keys) covers only profile, Calendar, and Tasks; Drive and Photos are not yet described.

The authorized redirect URI is `APP_URL + /api/oauth2callback` (`API_ROUTES.googleAuthCallback`), served by `GoogleAuthController` under the global `/api` prefix. Storage features (`/login` storage status, `/share`, `/drive` links) check `hasStorageScopes()` (token scope contains both `drive` and `photoslibrary`); tokens granted before these scopes were added must reconnect via `/login`.
