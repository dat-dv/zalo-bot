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

AI (`LlmService`, provider per `LLM_PROVIDER`) may receive only minimal extracted text for semantic classification, categorization, summarization, or ambiguity resolution. It never bypasses confirmation, authorization, validation, or audit controls: tool calls only create pending actions.

Raw-media AI is an approved exception only when local processing cannot meet the requirement and the exception records the reason, data minimization, cost impact, and fallback. Dependencies, language models, and runtime-image changes require an approved implementation plan. A local LLM is available via the `qwen` provider (Ollama-compatible endpoint).

## Approved exceptions

- **External LLM router first** (`LLM_PROVIDER=router`, 9router, fallback Gemini). Reason: owner's choice of cost/availability over a single provider. Data: every prompt `LlmService` sends (bot-addressed chat text, OCR text of receipts, memory snippets) goes to the router's upstream (currently a free DeepSeek model) and, on failure, to Gemini. Minimization rules above are unchanged. Fallback/rollback: `LLM_PROVIDER=gemini` or `qwen` for on-prem.

- **Chat memory** (`modules/zca/chat-memory.md`). Reason: understanding questions about past conversations, keeping a persona, and learning stable facts need language understanding; local full-text search only finds candidates. Data per bot turn: the chat's notes (≤20 × 200 chars), learned facts about the bot, the sender and the people tagged (≤15 lines, long-term on); no recent-message window (removed 2026-10-26). Per history question: ≤80 matched lines (the agent picks how many hits, 1–50) plus the chat's Cognee graph context (≤6000 chars). **Nightly (owner's decision, 2026-10-25)**: the whole day of each long-term chat (members' messages and confirmed actions, numbers of 12+ digits masked, no media URLs, no recalled messages) goes to the LLM configured for the `cognee` service (`COGNEE_LLM_*`, intended 9router), 1 call per ~1500-token chunk, plus one `LlmService` call per learned subject (bot + ≤10 members). Text read from photos travels like message text; photo bytes never leave the server. Fallback: point `COGNEE_LLM_*` and `LLM_PROVIDER` to `qwen` for on-prem, or leave `COGNEE_USER_PASSWORD` empty to disable Cognee. Memories are off by default per thread.
