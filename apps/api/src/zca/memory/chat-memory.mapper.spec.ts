import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IMAGE_TEXT_MIN_CONFIDENCE,
  MEMORY_TEXT_MAX_CHARS,
  buildImageMemoryText,
  buildMemoryText,
  cleanOcrTextForMemory,
  formatMemoryLine,
  toMemoryRecord,
  toSentAt,
} from './chat-memory.mapper';

void test('toMemoryRecord maps a plain text message', () => {
  const record = toMemoryRecord('g-1', 'group', {
    msgId: 7001,
    cliMsgId: '55',
    msgType: 'webchat',
    ts: '1720785780000',
    content: 'Tuần sau đi Đà Lạt nhé',
    uidFrom: 'u-1',
    dName: 'Đạt',
    quote: { globalMsgId: 6990 },
  });

  assert.ok(record);
  assert.equal(record.msgId, '7001');
  assert.equal(record.cliMsgId, '55');
  assert.equal(record.text, 'Tuần sau đi Đà Lạt nhé');
  assert.equal(record.content, null);
  assert.equal(record.senderName, 'Đạt');
  assert.equal(record.quoteMsgId, '6990');
  assert.equal(record.isBot, false);
  assert.equal(record.sentAt.getTime(), 1720785780000);
});

void test('toMemoryRecord keeps caption and drops media urls', () => {
  const record = toMemoryRecord('g-1', 'group', {
    msgId: '1',
    msgType: 'chat.photo',
    ts: 1720785780000,
    content: { title: 'Bãi biển Mũi Né', href: 'https://cdn.zalo/x.jpg', thumb: 'https://t' },
  });

  assert.ok(record);
  assert.equal(record.text, '[Ảnh] Bãi biển Mũi Né');
  assert.deepEqual(record.content, { title: 'Bãi biển Mũi Né' });
});

void test('buildMemoryText labels files, uncaptioned media and JSON string content', () => {
  assert.equal(buildMemoryText('sharefile', { title: 've-may-bay.pdf' }), '[File: ve-may-bay.pdf]');
  assert.equal(buildMemoryText('chat.voice', { href: 'https://v' }), '[Ghi âm]');
  assert.equal(
    buildMemoryText('chat.photo', JSON.stringify({ description: 'hoá đơn' })),
    '[Ảnh] hoá đơn',
  );
  assert.equal(buildMemoryText('webchat', '{not json'), '{not json');
});

void test('toMemoryRecord skips payloads without id and truncates long text', () => {
  assert.equal(toMemoryRecord('g-1', 'group', { content: 'no id' }), null);
  assert.equal(toMemoryRecord('', 'group', { msgId: '1', content: 'no channel' }), null);

  const long = toMemoryRecord('u-1', 'user', { msgId: '2', content: 'a'.repeat(5000) });
  assert.equal(long?.text?.length, MEMORY_TEXT_MAX_CHARS);
});

void test('toSentAt falls back for missing or invalid timestamps', () => {
  const fallback = new Date('2026-01-01T00:00:00Z');
  assert.equal(toSentAt(undefined, fallback), fallback);
  assert.equal(toSentAt('abc', fallback), fallback);
});

void test('formatMemoryLine renders local time and speaker', () => {
  const line = formatMemoryLine(
    { sentAt: new Date('2025-07-12T12:03:00Z'), senderName: 'Đạt', isBot: false, text: 'đi thôi' },
    'Asia/Ho_Chi_Minh',
  );
  assert.equal(line, '[2025-07-12 19:03] Đạt: đi thôi');

  const botLine = formatMemoryLine(
    { sentAt: new Date('2025-07-12T12:03:00Z'), senderName: null, isBot: true, text: 'ok' },
    'Asia/Ho_Chi_Minh',
  );
  assert.equal(botLine, '[2025-07-12 19:03] Bot: ok');
});

void test('cleanOcrTextForMemory keeps real text lines and joins them on one line', () => {
  const raw = "CƠM GÀ   45.000\n| ~ ' ee\n\nBÚN BÒ 50.000\n_—";
  assert.equal(cleanOcrTextForMemory(raw, 82), 'CƠM GÀ 45.000 / BÚN BÒ 50.000');
});

void test('cleanOcrTextForMemory drops photos without real text', () => {
  // Low confidence: Tesseract guessing on a face or scenery.
  assert.equal(cleanOcrTextForMemory('Họp lúc 9h sáng thứ hai', IMAGE_TEXT_MIN_CONFIDENCE - 1), '');
  // Only symbol noise.
  assert.equal(cleanOcrTextForMemory("|| ~~ '' —\n; : ,", 90), '');
  // Too few letters to be text.
  assert.equal(cleanOcrTextForMemory('ok', 90), '');
});

void test('buildImageMemoryText appends the photo text and respects both caps', () => {
  assert.equal(
    buildImageMemoryText('[Ảnh] menu trưa', 'CƠM GÀ 45.000'),
    '[Ảnh] menu trưa — chữ trong ảnh: CƠM GÀ 45.000',
  );
  assert.equal(buildImageMemoryText('', 'abc'), '[Ảnh] — chữ trong ảnh: abc');
  assert.equal(buildImageMemoryText('[Ảnh]', 'abcdefgh', 5), '[Ảnh] — chữ trong ảnh: abcd…');

  const long = buildImageMemoryText('[Ảnh]', 'x'.repeat(5000));
  assert.equal(long.length, MEMORY_TEXT_MAX_CHARS);
  assert.ok(long.endsWith('…'));
});
