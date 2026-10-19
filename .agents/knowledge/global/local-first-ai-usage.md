---
metadata:
  agent-artifact:
    id: global-local-first-ai-usage-knowledge
    type: documentation
    depends_on:
      - apps/api/src/ocr/ocr.service.ts
      - apps/api/src/llm/llm.service.ts
      - apps/api/src/zca/pending-image/strategies/create-bill-pending-image.strategy.ts
      - apps/api/src/zalo/input-processor.service.ts
---

# Local-First AI Usage

Media and deterministic extraction are local-first to conserve AI tokens and reduce external disclosure. OCR, parsing, conversion, metadata, and validation must use an installed local capability before AI is considered.

- Receipt images: `OcrService` (Sharp pre-processing + Tesseract.js `vie+eng`) extracts text locally; `LlmService` receives only that text plus prompt context, never image bytes or base64.
- Voice messages are not transcribed: the official-bot webhook path replies that voice handling is under development, and ZCA only backs up `chat.voice` audio to Drive when the thread's `mediaBackup.uploadAudios` is enabled. There is no speech-to-text runtime.

AI (`LlmService`, provider per `LLM_PROVIDER`) may receive only minimal extracted text for semantic classification, categorization, summarization, or ambiguity resolution. It never bypasses confirmation, authorization, validation, or audit controls: tool calls only create pending actions.

Raw-media AI is an approved exception only when local processing cannot meet the requirement and the exception records the reason, data minimization, cost impact, and fallback. Dependencies, language models, and runtime-image changes require an approved implementation plan. A local LLM is available via the `qwen` provider (Ollama-compatible endpoint).
