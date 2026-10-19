/**
 * Utility to manage and format datetime context in Vietnamese timezone (Asia/Ho_Chi_Minh).
 */

export interface VietnamDateTimeContext {
  weekday: string; // e.g. "Thứ Hai", "Chủ Nhật"
  day: string; // e.g. "19"
  month: string; // e.g. "10"
  year: string; // e.g. "2026"
  hour: string; // e.g. "12"
  minute: string; // e.g. "45"
  second: string; // e.g. "18"
  time: string; // e.g. "12:45:18"
  timeZone: string; // "Asia/Ho_Chi_Minh"
  offsetStr: string; // "+07:00"
  formattedDate: string; // "Thứ Hai, ngày 19 tháng 10 năm 2026"
  formattedDateTime: string; // "Thứ Hai, ngày 19 tháng 10 năm 2026, 12:45:18"
  isoLocal: string; // "2026-10-19T12:45:18+07:00"
  isoUtc: string; // "2026-10-19T05:45:18.000Z"
  systemInstructionSnippet: string;
}

const WEEKDAY_MAP: Record<string, string> = {
  Monday: 'Thứ Hai',
  Tuesday: 'Thứ Ba',
  Wednesday: 'Thứ Tư',
  Thursday: 'Thứ Năm',
  Friday: 'Thứ Sáu',
  Saturday: 'Thứ Bảy',
  Sunday: 'Chủ Nhật',
};

/**
 * Get detailed date and time context in target timezone (default: Asia/Ho_Chi_Minh).
 * Provides day-of-week in Vietnamese, exact local time, and clear guidance for LLM.
 */
export function getVietnamDateTimeContext(
  date: Date = new Date(),
  timeZone = 'Asia/Ho_Chi_Minh',
): VietnamDateTimeContext {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'long',
  });

  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const weekday = WEEKDAY_MAP[parts.weekday] || parts.weekday;
  const day = parts.day.padStart(2, '0');
  const month = parts.month.padStart(2, '0');
  const year = parts.year;
  const hour = parts.hour.padStart(2, '0');
  const minute = parts.minute.padStart(2, '0');
  const second = parts.second.padStart(2, '0');

  // Determine timezone offset string (e.g. +07:00 for Asia/Ho_Chi_Minh)
  const tzDtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  });
  const tzPart = tzDtf.formatToParts(date).find((p) => p.type === 'timeZoneName');
  let offsetStr = '+07:00';
  if (tzPart && tzPart.value.startsWith('GMT')) {
    const raw = tzPart.value.replace('GMT', '');
    offsetStr = raw || '+00:00';
  }

  const time = `${hour}:${minute}:${second}`;
  const isoLocal = `${year}-${month}-${day}T${time}${offsetStr}`;
  const isoUtc = date.toISOString();
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const formattedDate = `${weekday}, ngày ${dayNum} tháng ${monthNum} năm ${year}`;
  const formattedDateTime = `${formattedDate}, ${time}`;

  const systemInstructionSnippet =
    `[THỜI GIAN VÀ NGÀY THÁNG THỰC TẾ (Múi giờ ${timeZone}, GMT${offsetStr})]\n` +
    `- Hôm nay là: ${weekday}, ngày ${day}/${month}/${year}.\n` +
    `- Thời gian hiện tại: ${formattedDateTime} (ISO chuẩn: ${isoLocal}).\n` +
    `- Khi người dùng hỏi về hôm nay là thứ mấy, ngày mấy, tháng mấy, năm mấy hoặc hỏi giờ: LUÔN trả lời chính xác dựa theo thông tin trên (ví dụ: "Hôm nay là ${weekday}, ngày ${dayNum} tháng ${monthNum} năm ${year}"). TUYỆT ĐỐI KHÔNG tự tính nhầm sang thứ khác (đặc biệt không nhầm Thứ Hai thành Chủ Nhật).\n` +
    `- Khi người dùng dùng các từ chỉ thời gian tương đối như "hôm nay", "ngày mai", "ngày kia", "hôm qua", "thứ 2", "thứ 3", "chủ nhật", "tuần này", "tuần sau"... để tạo lịch, nhắc việc, ghi nhận thu chi hay báo cáo: LUÔN căn cứ vào mốc hôm nay là ${weekday} (${isoLocal}) để tính ngày giờ ISO chính xác.`;

  return {
    weekday,
    day,
    month,
    year,
    hour,
    minute,
    second,
    time,
    timeZone,
    offsetStr,
    formattedDate,
    formattedDateTime,
    isoLocal,
    isoUtc,
    systemInstructionSnippet,
  };
}

/**
 * Returns the exact start of day (00:00:00.000) and end of day (23:59:59.999)
 * for a specific date in the given timezone, independent of server timezone.
 */
export function getStartAndEndOfDayInTz(
  date: Date = new Date(),
  timeZone = 'Asia/Ho_Chi_Minh',
): { startOfDay: Date; endOfDay: Date } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));

  const tzDtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  });
  const tzPart = tzDtf.formatToParts(date).find((p) => p.type === 'timeZoneName');
  let offsetStr = '+07:00';
  if (tzPart && tzPart.value.startsWith('GMT')) {
    const raw = tzPart.value.replace('GMT', '');
    offsetStr = raw || '+00:00';
  }

  const startOfDay = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000${offsetStr}`);
  const endOfDay = new Date(`${parts.year}-${parts.month}-${parts.day}T23:59:59.999${offsetStr}`);
  return { startOfDay, endOfDay };
}
