function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Xử lý và loại bỏ bot mention (@Bot, @<botName>) khỏi câu lệnh hoặc tin nhắn.
 * Hỗ trợ các trường hợp:
 * 1. @Bot ở đầu câu (ví dụ: "@Bot /dashboard", "@Bot nợ a 100k")
 * 2. @Bot ở cuối câu (ví dụ: "/dashboard @Bot", "nợ a 100k @Bot")
 * 3. @Bot ngay sau slash command (ví dụ: "/dashboard @Bot Teétajjsne", "/dashboard@Bot")
 * 4. @Bot ở giữa câu (ví dụ: "nhắc @Bot ngày mai họp")
 */
export function cleanBotMention(text: string, botName = 'Bot'): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  const cleanName = (botName || 'Bot').replace(/^@/, '').trim();
  const baseNames = [cleanName, 'Bot Finance Assistant', 'Finance Assistant', 'Bot', 'bot'];
  const names = Array.from(new Set(baseNames.filter(Boolean))).sort((a, b) => b.length - a.length);
  const namePattern = names.map(escapeRegex).join('|');

  let result = trimmed;

  // Trường hợp 1: @Bot ở đầu câu (ví dụ: "@Bot /dashboard", "@Bot: nợ a 100k")
  const startRegex = new RegExp(`^@(?:${namePattern})\\b[\\s,:.-]*`, 'i');
  result = result.replace(startRegex, '').trim();

  // Trường hợp 2: @Bot ở cuối câu (ví dụ: "/dashboard @Bot", "nợ a 100k, @Bot", "/ping: @Bot")
  const endRegex = new RegExp(`[\\s,:.-]*@(?:${namePattern})\\b$`, 'i');
  result = result.replace(endRegex, '').trim();

  // Trường hợp ngay sau lệnh slash (ví dụ: "/dashboard @Bot Teétajjsne" hoặc "/dashboard@Bot")
  const cmdMentionRegex = new RegExp(
    `^(\\/[a-zA-Z0-9_]+)(?:@(?:${namePattern})\\b|\\s+@(?:${namePattern})\\b)`,
    'i',
  );
  result = result.replace(cmdMentionRegex, '$1').trim();

  // Trường hợp độc lập ở giữa câu
  const inlineRegex = new RegExp(`\\s*@(?:${namePattern})\\b[:,-]?`, 'gi');
  result = result.replace(inlineRegex, ' ').replace(/\s+/g, ' ').trim();

  return result;
}
