# Public Google OAuth Verification

zalobot requests only `openid`, `userinfo.email`, `userinfo.profile`, Google Calendar, and Google Tasks scopes. Each requested scope must map to an implemented user-facing action; do not pre-request Gmail, Drive, Sheets, Docs, Contacts, or other future capabilities.

The public review surface is `/about`, `/privacy`, and `/terms` on `https://zalobot.datintech.site`. The privacy page must state the Google data categories, purpose, retention/deletion contact, and Google API Services User Data Policy Limited Use commitment. `datdoan.dev@gmail.com` is the published privacy contact until replaced by an approved support address.

Production uses a verified HTTPS domain. The exact `APP_URL + /api/oauth2callback` value is the authorized Google OAuth redirect URI. Existing tokens with superseded scopes remain valid until users reauthorize or revoke access; new consent requests use the minimized scope list.
