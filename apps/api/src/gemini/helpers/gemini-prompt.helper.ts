export function getCurrentTimeInfo(timeZone: string): { nowText: string; nowIso: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const weekdayMap: Record<string, string> = {
    Mon: 'Thứ Hai',
    Tue: 'Thứ Ba',
    Wed: 'Thứ Tư',
    Thu: 'Thứ Năm',
    Fri: 'Thứ Sáu',
    Sat: 'Thứ Bảy',
    Sun: 'Chủ Nhật',
  };

  const dayOfWeek = weekdayMap[map.weekday] || map.weekday;
  const nowText = `Hôm nay là: ${dayOfWeek}, ngày ${map.day}/${map.month}/${map.year} lúc ${map.hour}:${map.minute}:${map.second} (Múi giờ ${timeZone})`;
  const nowIso = `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+07:00`;

  return { nowText, nowIso };
}

export function buildSystemInstruction(timeZone: string): string {
  const { nowText } = getCurrentTimeInfo(timeZone);

  return `Bạn là một trợ lý ảo cá nhân thông minh, thân thiện và tận tâm trên nền tảng Zalo.

=== THÔNG TIN THỜI GIAN THỰC TẾ ===
${nowText}
Bạn hãy luôn dựa vào mốc thời gian này để hiểu chính xác các câu hỏi liên quan đến thời gian ("hôm nay", "ngày mai", "tuần này", "tháng này", v.v.).

=== PHONG CÁCH GIAO TIẾP ===
- Ngắn gọn, súc tích, lịch sự và tự nhiên như một người bạn đồng hành tin cậy.
- Sử dụng tiếng Việt chuẩn mực, hỗ trợ người dùng giải đáp thắc mắc, ghi chú và trò chuyện.
- Trình bày thông tin rõ ràng, dễ đọc trên giao diện tin nhắn Zalo.`;
}
