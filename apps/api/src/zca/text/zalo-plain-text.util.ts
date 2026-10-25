import type { MessageContent } from '../shapes';

/**
 * Zalo renders chat text as is, so markdown the LLM writes by habit (`**bold**`, `# heading`)
 * reaches people as raw symbols. Appended to every prompt whose text may be sent to a chat.
 * Also sets the tone: LLM replies pile on emoji and pleasantries, which reads as a bot.
 */
export const ZALO_PLAIN_TEXT_INSTRUCTION =
  'ĐỊNH DẠNG TIN NHẮN:\n' +
  '- Zalo không hiển thị markdown. Chỉ viết văn bản thuần: KHÔNG dùng **, __, #, dấu `, bảng hay [chữ](link).\n' +
  '- Viết như người thật nhắn tin: câu ngắn, vào thẳng ý, không mở đầu hay kết thúc bằng câu xã giao, không nhắc lại yêu cầu của người dùng.\n' +
  '- Tối đa 1 emoji mỗi tin, không viết hoa cả câu. Gạch đầu dòng dùng "•" hoặc "-".';

const MARKDOWN_LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
const URL = /https?:\/\/[^\s<>"'`]+/g;
/** Markdown wrappers glued to the end of a URL (`**https://…**`) are not part of it. */
const URL_TRAILING_MARKERS = /(\*+|_{2,})$/;
const URL_PLACEHOLDER = /\uE000(\d+)\uE001/g;

const FENCE_LINE = /^\s*```[\w-]*\s*$/;
const RULE_LINE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const HEADING = /^(\s*)#{1,6}\s+/;
const STAR_BULLET = /^(\s*)[*+]\s+/;

const BOLD_ITALIC = /\*\*\*(?=\S)([^\n]*?\S)\*\*\*/g;
const BOLD_STARS = /\*\*(?=\S)([^\n]*?\S)\*\*/g;
const BOLD_UNDERSCORES = /__(?=\S)([^\n]*?\S)__/g;
/** Only `*` glued to words, so `5*3` and `a * b` stay. */
const ITALIC_STARS = /(^|[\s(["'])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?=$|[\s.,!?:;)\]"'])/gm;
const INLINE_FENCE = /```/g;
const INLINE_CODE = /`([^`\n]+)`/g;
/** Left over when the LLM forgets to close a marker, or a long text was split mid-marker. */
const STRAY_MARKERS = /\*{2,}|_{2,}/g;
const EXTRA_BLANK_LINES = /\n{3,}/g;

/** Plain-text rewrite of LLM markdown; URLs are kept byte for byte. */
export function toZaloPlainText(text: string): string {
  const urls: string[] = [];
  const keepUrl = (url: string): string => {
    urls.push(url);
    return `\uE000${urls.length - 1}\uE001`;
  };

  let result = text.replace(MARKDOWN_LINK, (_match, label: string, url: string) =>
    label.trim() === url ? url : `${label}: ${url}`,
  );
  result = result.replace(URL, (match) => {
    const url = match.replace(URL_TRAILING_MARKERS, '');
    return keepUrl(url) + match.slice(url.length);
  });

  result = result
    .split('\n')
    .filter((line) => !FENCE_LINE.test(line) && !RULE_LINE.test(line))
    .map((line) => line.replace(HEADING, '$1').replace(STAR_BULLET, '$1• '))
    .join('\n');

  result = result
    .replace(BOLD_ITALIC, '$1')
    .replace(BOLD_STARS, '$1')
    .replace(BOLD_UNDERSCORES, '$1')
    .replace(ITALIC_STARS, '$1$2')
    .replace(INLINE_FENCE, '')
    .replace(INLINE_CODE, '$1')
    .replace(STRAY_MARKERS, '')
    .replace(EXTRA_BLANK_LINES, '\n\n')
    .replace(URL_PLACEHOLDER, (_match, index: string) => urls[Number(index)] ?? '');

  // A message made only of markdown would otherwise go out empty.
  return result.trim() ? result : text;
}

/** Mentions and styles point at character positions in `msg`, so those messages go out as built. */
export function toZaloPlainMessage(message: MessageContent | string): MessageContent | string {
  if (typeof message === 'string') return toZaloPlainText(message);
  if (message.mentions?.length || message.styles?.length) return message;
  return { ...message, msg: toZaloPlainText(message.msg) };
}
