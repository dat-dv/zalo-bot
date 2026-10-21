import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMORY_TEXT_MAX_CHARS,
  buildMemoryText,
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
