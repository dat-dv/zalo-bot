# Environment Guard

Human guide: [Environment Guard](../../docs/global/environment-guard.md).

## Purpose

Runtime configuration is an explicit deployment contract. API startup and dashboard build must fail before serving traffic when a required environment variable is missing or malformed.

## Contract

- API loads root `.env` then `.env.local`; `.env.local` has development precedence, while process-provided variables remain valid deployment inputs.
- Required API values are parsed once into Nest configuration: public URLs, port, CORS and polling flags, zalo credentials, Gemini settings, Google OAuth client credentials, dashboard secrets, encryption key, AI/OCR limits, and timezone.
- `zalo_ALLOWED_USER_IDS` is optional. GramJS flash-call variables are optional as a group, but all three must be present when enabled.
- Consumers use validated config values only; they must not read `process.env` or provide their own environment defaults.
- The static dashboard requires a valid `NEXT_PUBLIC_API_URL` during both configuration load and browser client initialization.

## Integration

- `.env.example` is the complete non-secret key inventory.
- Secret values are never included in errors, logs, source, or documentation.
- Deployment systems must provide every required value rather than relying on local host defaults.
