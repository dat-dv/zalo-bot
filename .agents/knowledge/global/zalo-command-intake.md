# Zalo Command Intake

The system receives commands and user events through a dual-channel ingress:

1. **Official Zalo Bot Platform Webhook**: Managed by `ZaloController` (`POST /webhook`), verified with `X-Bot-Api-Secret-Token`, normalized via `ZaloMessageParserService`, and throttled via `InputProcessorService` (whitelist & 2-second cooldown).
2. **Personal Zalo Client Account (ZCA)**: Powered by `zca-js` via WebSocket managed by `ZcaService` and `ZcaBotFeatureService`. Supports QR login (`/zlogin`), configurable trigger prefix (`@bot`), per-thread mention policies (`requireMention`), and reaction listeners (❤️ Heart confirm, 😡 Angry cancel).

Intake routing:
- Fast-path slash commands (`/start`, `/help`, `/finance`, `/tasks`, `/drive`, etc.) dispatch to corresponding strategy handlers in `apps/api/src/zalo/text/strategies/`.
- Natural language messages are evaluated by `LlmService` (Gemini, OpenAI, Qwen) for structured tool calling.
- Sensitive mutations queue an interactive 3-digit confirmation card with a 5-minute timeout managed by `TransactionConfirmationService`.
- Upon resolution (confirm, cancel, timeout, edit), intermediate confirmation cards are automatically recalled (`undoMessage` / `zca.undo`), keeping conversation transcripts clean and free of dead buttons.
- The API test command (`npm run test --workspace @zalobot/api`) discovers all `src/**/*.spec.ts` files using a decorator-aware TypeScript runner.

