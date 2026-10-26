/**
 * Text helpers shared by the memories: folding Vietnamese for matching, turning a bot success
 * summary into the plain line stored as a confirmed action, and masking long numbers.
 */

/** Lower case without diacritics (`đ` → `d`), single spaces: for matching, never for display. */
export function foldVietnamese(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Single spaces, trimmed; notes and facts are short one-liners. */
export function collapseWhitespace(value: string): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

const PICTOGRAPHS = /\p{Extended_Pictographic}|\u{FE0F}|\u{200D}|\u{20E3}/gu;

/**
 * `✅ [358] Chi 5.000đ · Đi lại · gửi xe\n📍 hồ bơi tây thạnh · 🕗 08:00 25/10` →
 * `(đã duyệt) Chi 5.000đ · Đi lại · gửi xe · hồ bơi tây thạnh · 08:00 25/10`. Empty when nothing
 * is left. The marker tells the LLM and Cognee this was done, not just said.
 */
export function confirmedActionText(summary: string): string {
  const body = (summary || '')
    .replace(PICTOGRAPHS, ' ')
    .replace(/\[\d+\]/g, ' ')
    .split('\n')
    .map((line) => collapseWhitespace(line).replace(/^[·\s]+|[·\s]+$/g, ''))
    .filter(Boolean)
    .join(' · ');
  return body ? `(đã duyệt) ${body}` : '';
}

/** Every word of `query` (2+ chars, folded) appears in `text`. */
export function matchesAllWords(text: string, query: string): boolean {
  const words = foldVietnamese(query)
    .split(' ')
    .filter((word) => word.length >= 2);
  if (words.length === 0) return false;
  const haystack = ` ${foldVietnamese(text)} `;
  return words.every((word) => haystack.includes(word));
}
