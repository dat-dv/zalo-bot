import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * What a stored chat message is, which decides the memories that may use it. Human messages are
 * `chat` unless they asked the bot for a tool call (`request`); bot messages are tagged where they
 * are sent (see `OutgoingMemoryKind`). `action` rows are written only after a confirmed tool call
 * ran successfully, so cancelled or failed requests never become memories.
 */
export const MEMORY_KINDS = [
  'chat',
  'request',
  'action',
  'bot_chat',
  'tool',
  'reminder',
  'result',
  'card',
  'system',
  'secret',
] as const;

export type MemoryKind = (typeof MEMORY_KINDS)[number];

/** Kinds shown in the short-term window: the conversation without confirmation noise. */
export const SHORT_TERM_KINDS: readonly MemoryKind[] = [
  'chat',
  'request',
  'action',
  'bot_chat',
  'tool',
  'reminder',
];

/**
 * Kinds sent to Cognee and to the learned facts: what people said and what was really done.
 * Bot replies, read-only tool answers and requests stay out so that made-up chit-chat, stale
 * numbers and cancelled requests are never learned.
 */
export const LONG_TERM_INGEST_KINDS: readonly MemoryKind[] = ['chat', 'action'];

/** Stored instead of the text of a `secret` message (dashboard sign-in link and code). */
export const SECRET_MESSAGE_PLACEHOLDER = '[Link đăng nhập dashboard]';

export function isMemoryKind(value: unknown): value is MemoryKind {
  return typeof value === 'string' && (MEMORY_KINDS as readonly string[]).includes(value);
}

const outgoingKind = new AsyncLocalStorage<MemoryKind>();

/**
 * Kind of the bot messages sent inside `run`. The ZCA `sendMessage` wrapper reads it when it
 * stores a sent message, so senders tag their messages without changing every send signature.
 */
export const OutgoingMemoryKind = {
  run<T>(kind: MemoryKind, fn: () => T): T {
    return outgoingKind.run(kind, fn);
  },
  current(): MemoryKind | undefined {
    return outgoingKind.getStore();
  },
};
