import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmedActionText, foldVietnamese, matchesAllWords } from './memory-text.util';
import { buildMemoryProfileBlock, BOT_IDENTITY_LINE } from './memory-profile.util';

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
