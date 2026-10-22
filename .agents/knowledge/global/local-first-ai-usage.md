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
---

# Local-First AI Usage

Media and deterministic extraction are local-first to conserve AI tokens and reduce external disclosure. OCR, parsing, conversion, metadata, and validation must use an installed local capability before AI is considered.

- Receipt images: `OcrService` (Sharp pre-processing + Tesseract.js `vie+eng`) extracts text locally; `LlmService` receives only that text plus prompt context, never image bytes or base64.
- Voice messages are not transcribed: ZCA only backs up `chat.voice` audio to Drive when the thread's `mediaBackup.uploadAudios` is enabled. There is no speech-to-text runtime.

AI (`LlmService`, provider per `LLM_PROVIDER`) may receive only minimal extracted text for semantic classification, categorization, summarization, or ambiguity resolution. It never bypasses confirmation, authorization, validation, or audit controls: tool calls only create pending actions.

Raw-media AI is an approved exception only when local processing cannot meet the requirement and the exception records the reason, data minimization, cost impact, and fallback. Dependencies, language models, and runtime-image changes require an approved implementation plan. A local LLM is available via the `qwen` provider (Ollama-compatible endpoint).

## Approved exceptions

- **External LLM router first** (`LLM_PROVIDER=router`, 9router, fallback Gemini). Reason: owner's choice of cost/availability over a single provider. Data: every prompt `LlmService` sends (bot-addressed chat text, OCR text of receipts, memory snippets) goes to the router's upstream (currently a free DeepSeek model) and, on failure, to Gemini. Minimization rules above are unchanged. Fallback/rollback: `LLM_PROVIDER=gemini` or `qwen` for on-prem.

- **Chat memory answers** (`SEARCH_CHAT_HISTORY`, `modules/zca/chat-memory.md`). Reason: answering questions about past conversations needs language understanding; local full-text search only finds candidates. Minimization: only matched lines (≤80, `[date] sender: text`, no media URLs) plus the latest `chatMemory.contextWindow` messages of the thread; never the full history. Cost: one extra tool-free LLM call per memory question. Uses the shared provider chain; set `LLM_PROVIDER=qwen` to keep it on-prem; chat memory is off by default and enabled per thread by an admin.
