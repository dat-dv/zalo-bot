import { maskLongNumbers } from '../memory-text.util';

/** One stored message of the day, already filtered to what may reach the long-term memory. */
export interface ChatDayLine {
  sentAt: Date;
  senderName: string | null;
  text: string;
}

function timeOfDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/** `25/10/2026 (Thứ Bảy)` for a `YYYY-MM-DD` day. */
export function vietnameseDayLabel(day: string): string {
  const [year, month, date] = day.split('-');
  // Noon UTC keeps the weekday right whatever the server zone is.
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );
  const label = weekday.charAt(0).toLocaleUpperCase('vi') + weekday.slice(1);
  return `${date}/${month}/${year} (${label})`;
}

/** File name of a chat day in Cognee; stable, so a resent day replaces nothing by accident. */
export function chatDayFileName(channelId: string, day: string): string {
  return `${channelId}_${day}.txt`;
}

/**
 * The text of one chat day sent to Cognee: a dated header (Cognee extracts dates from the text,
 * which is what lets it answer time questions) and `HH:mm Name: text` lines. Long numbers are
 * masked before the text leaves the server. Empty when the day has no line.
 */
export function buildChatDayDocument(
  channelName: string,
  day: string,
  lines: readonly ChatDayLine[],
  timeZone: string,
): string {
  if (lines.length === 0) return '';
  const header = `Nhật ký cuộc trò chuyện "${channelName}" ngày ${vietnameseDayLabel(day)}`;
  const body = lines.map(
    (line) =>
      `${timeOfDay(line.sentAt, timeZone)} ${line.senderName || 'Ai đó'}: ${maskLongNumbers(line.text)}`,
  );
  return [header, ...body].join('\n');
}
