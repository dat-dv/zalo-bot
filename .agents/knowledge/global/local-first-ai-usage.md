---
metadata:
  agent-artifact:
    id: global-local-first-ai-usage-knowledge
    type: documentation
    depends_on:
      - apps/api/src/ocr/ocr.service.ts
      - apps/api/src/llm/llm.service.ts
      - apps/api/src/zca/pending-image/strategies/create-bill-pending-image.strategy.ts
      - apps/api/src/zca/text/strategies/search-chat-history-tool.strategy.ts
      - apps/api/src/zca/memory/image-text-memory.service.ts
---

# Local-First AI Usage

Media and deterministic extraction are local-first to conserve AI tokens and reduce external disclosure. OCR, parsing, conversion, metadata, and validation must use an installed local capability before AI is considered.

- Receipt images: `OcrService` (Sharp pre-processing + Tesseract.js `vie+eng`) extracts text locally; `LlmService` receives only that text plus prompt context, never image bytes or base64.
- Chat photos for chat memory: the same local OCR reads every photo of a thread with a memory and `chatMemory.readImageText` on, in a background queue; only the cleaned text is stored (see `modules/zca/chat-memory.md`).
- Voice messages are not transcribed: ZCA only backs up `chat.voice` audio to Drive when the thread's `mediaBackup.uploadAudios` is enabled. There is no speech-to-text runtime.

AI (`LlmService`, providers from the dashboard-managed `llm_providers` chain) may receive only minimal extracted text for semantic classification, categorization, summarization, or ambiguity resolution. It never bypasses confirmation, authorization, validation, or audit controls: tool calls only create pending actions.

Raw-media AI is an approved exception only when local processing cannot meet the requirement and the exception records the reason, data minimization, cost impact, and fallback. Dependencies, language models, and runtime-image changes require an approved implementation plan. A local LLM is available via the `qwen` provider (Ollama-compatible endpoint).

## Approved exceptions

- **External LLM router first** (chain `router` (9router) → `gemini` in `llm_providers`, seeded from the former `LLM_PROVIDER=router` env). Reason: owner's choice of cost/availability over a single provider. Data: every prompt `LlmService` sends (bot-addressed chat text, OCR text of receipts, memory snippets) goes to the router's upstream (currently a free DeepSeek model) and, on failure, to Gemini. Minimization rules above are unchanged. Fallback/rollback: turn the router row off or move `gemini` / an `ollama` row (on-prem) to the top on the dashboard.

- **Chat memory** (`modules/zca/chat-memory.md`). Reason: answering questions about past conversations and keeping a persona need language understanding. Remembering itself is local: messages are embedded on the server (MiniLM via transformers.js) and searched in Postgres (keywords + pgvector); since 2026-11-17 no message is sent anywhere to be remembered (Cognee removed: its per-chunk LLM graph extraction used up the free quota shared with chat). Data per bot turn: the chat's notes (≤20 × 200 chars) and the learned facts kept from before (bot, sender, tagged people; ≤15 lines, long-term on); no recent-message window (removed 2026-10-26). Per history question: ≤80 found lines (the agent picks how many hits, 1–50) in one `LlmService` call that writes the answer, as written (nothing masked). Text read from photos travels like message text; photo bytes never leave the server. No nightly LLM job (learned-facts learning removed). Memories are off by default per thread.
