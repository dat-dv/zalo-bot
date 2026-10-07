# Local Voice Transcription

## Purpose

zalo voice notes are transcribed locally before they reach Gemini. This prevents unreviewed speech recognition output from causing assistant actions.

## Runtime contract

- `whisper.cpp` runs on loopback at `WHISPER_URL`; it uses multilingual `ggml-base.bin` and no API key.
- The zalo handler accepts voice only up to `VOICE_MAX_DURATION_SECONDS` and `VOICE_MAX_BYTES`.
- The local server converts uploaded OGG/Opus safely with FFmpeg and returns JSON transcript text.
- Audio and transcript are not logged verbatim.

## State transitions

`voice received → transcribing → pending transcript (10 minutes) → confirmed → Gemini chat → existing tool confirmation when mutation is requested`.

`edit` and `cancel` remove the pending transcript. Expired or user-mismatched callbacks cannot submit content.

## Integration seams

- `VoiceTranscriptionService` owns zalo file retrieval, Whisper HTTP invocation, and pending transcript ownership.
- `zaloUpdate` owns zalo UI callbacks and delegates confirmed text to the existing Gemini request flow.
- Docker starts `whisper-server` only on `127.0.0.1:8080`; it is never exposed as a public port.
