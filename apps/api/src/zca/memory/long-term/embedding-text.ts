import { EMBED_MAX_CHARS } from './local-embedder';

/** Messages before a message that its embedding also reads (same chat, see the window below). */
export const EMBEDDING_CONTEXT_BEFORE = 2;

/** One stored line as the embedding reads it. */
export interface EmbeddingLine {
  senderName: string | null;
  text: string;
}

function lineText(line: EmbeddingLine): string {
  const text = line.text.replace(/\s+/g, ' ').trim();
  return line.senderName ? `${line.senderName}: ${text}` : text;
}

/**
 * Text embedded for one message: the message itself first (`Name: text`), then the messages just
 * before it, newest first, so short replies such as "ok chốt" carry what they answer. The model
 * reads a limited number of tokens from the start, so the message always fits and context lines
 * are dropped first when the text is too long.
 */
export function buildEmbeddingText(
  message: EmbeddingLine,
  contextBefore: readonly EmbeddingLine[],
): string {
  let text = lineText(message).slice(0, EMBED_MAX_CHARS);
  const context = contextBefore
    .slice(-EMBEDDING_CONTEXT_BEFORE)
    .reverse()
    .map(lineText)
    .filter((line) => line.length > 0);
  for (const line of context) {
    const next = `${text}\n${line}`;
    if (next.length > EMBED_MAX_CHARS) break;
    text = next;
  }
  return text;
}
