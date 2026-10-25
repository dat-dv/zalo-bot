import assert from 'node:assert/strict';
import test from 'node:test';
import {
  confirmedActionText,
  foldVietnamese,
  maskLongNumbers,
  matchesAllWords,
} from './memory-text.util';
import { buildMemoryProfileBlock, BOT_IDENTITY_LINE } from './memory-profile.util';
import {
  buildChatDayDocument,
  chatDayFileName,
  vietnameseDayLabel,
} from './long-term/chat-day-document';
import { buildLearnedFactsPrompt, parseLearnedFacts } from './long-term/learned-facts.prompt';

void test('foldVietnamese drops accents, đ and punctuation for matching', () => {
  assert.equal(foldVietnamese('  Mèo ĐEN, 2 mái! '), 'meo den 2 mai');
});

void test('matchesAllWords needs every word of the query', () => {
  assert.equal(matchesAllWords('Bot là con mèo đen 2 mái', 'meo den'), true);
  assert.equal(matchesAllWords('Bot là con mèo đen 2 mái', 'mèo trắng'), false);
  assert.equal(matchesAllWords('Bot là con mèo', ''), false);
});

void test('confirmedActionText turns a success notice into a plain done line', () => {
  assert.equal(
    confirmedActionText(
      '✅ [358] Chi 5.000đ · Đi lại · gửi xe\n📍 hồ bơi tây thạnh · 🕗 08:00 25/10',
    ),
    '(đã duyệt) Chi 5.000đ · Đi lại · gửi xe · hồ bơi tây thạnh · 08:00 25/10',
  );
  assert.equal(confirmedActionText('✅ [123]'), '');
});

void test('maskLongNumbers hides card and account numbers but keeps phone numbers', () => {
  assert.equal(maskLongNumbers('stk 0123 4567 8901 2345 nhé'), 'stk ***2345 nhé');
  assert.equal(maskLongNumbers('gọi 0912345678'), 'gọi 0912345678');
});

void test('buildMemoryProfileBlock lists notes with short ids, then learned facts', () => {
  const block = buildMemoryProfileBlock(
    [{ text: 'Bot là con mèo đen 2 mái' }, { text: 'Xưng em, gọi anh chị' }],
    [
      { subjectKind: 'bot', subjectName: 'Đen', fact: 'Thích làm thạch rau câu' },
      { subjectKind: 'member', subjectName: 'Diệu Hằng', fact: 'Ăn chay' },
    ],
  );
  assert.match(block, /\[n1\] Bot là con mèo đen 2 mái\n\[n2\] Xưng em, gọi anh chị/);
  assert.match(block, /- Về bạn: Thích làm thạch rau câu\n- Diệu Hằng: Ăn chay/);
  assert.equal(buildMemoryProfileBlock([], []), '');
  assert.match(BOT_IDENTITY_LINE, /ĐIỀU ĐƯỢC DẶN/);
});

void test('buildChatDayDocument dates the day and masks long numbers', () => {
  const text = buildChatDayDocument(
    'Gia đình',
    '2026-10-25',
    [
      {
        sentAt: new Date('2026-10-25T10:02:17Z'),
        senderName: 'Văn Đạt',
        text: 'tao dặn rồi mày là con mèo đen 2 mái',
      },
      { sentAt: new Date('2026-10-25T10:03:00Z'), senderName: null, text: 'stk 012345678901234' },
    ],
    'Asia/Ho_Chi_Minh',
  );
  assert.equal(
    text,
    'Nhật ký cuộc trò chuyện "Gia đình" ngày 25/10/2026 (Chủ Nhật)\n' +
      '17:02 Văn Đạt: tao dặn rồi mày là con mèo đen 2 mái\n' +
      '17:03 Ai đó: stk ***1234',
  );
  assert.equal(buildChatDayDocument('x', '2026-10-25', [], 'Asia/Ho_Chi_Minh'), '');
  assert.equal(vietnameseDayLabel('2026-10-26'), '26/10/2026 (Thứ Hai)');
  assert.equal(chatDayFileName('123', '2026-10-25'), '123_2026-10-25.txt');
});

void test('parseLearnedFacts reads the facts array, even inside extra text', () => {
  assert.deepEqual(parseLearnedFacts('```json\n{"facts": ["Ăn chay", "", 3]}\n```'), ['Ăn chay']);
  assert.deepEqual(parseLearnedFacts('không có'), []);
  assert.deepEqual(parseLearnedFacts('{"facts": "x"}'), []);
});

void test('buildLearnedFactsPrompt tells the model what not to learn again', () => {
  const prompt = buildLearnedFactsPrompt(
    { kind: 'member', userId: 'u2', name: 'Diệu Hằng' },
    'Đen',
    ['Diệu Hằng -- likes -- bánh tráng trộn chay'],
    ['Thích ăn cay'],
  );
  assert.match(prompt, /Đối tượng: "Diệu Hằng"/);
  assert.match(prompt, /KHÔNG đưa lại các ý đã bị người dùng xoá:\n- Thích ăn cay/);
});
