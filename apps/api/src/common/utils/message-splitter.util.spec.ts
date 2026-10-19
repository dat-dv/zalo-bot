import assert from 'node:assert/strict';
import test from 'node:test';
import { splitMessage } from './message-splitter.util';

void test('splitMessage returns empty array for empty or whitespace text', () => {
  assert.deepEqual(splitMessage(''), []);
  assert.deepEqual(splitMessage('   '), []);
});

void test('splitMessage returns single chunk when text length is within maxLength', () => {
  const text = 'Xin chào, đây là tin nhắn ngắn.';
  const chunks = splitMessage(text, 100);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], text);
});

void test('splitMessage splits long text on double newlines where possible', () => {
  const p1 = 'Phần 1: Hướng dẫn sử dụng cơ bản trợ lý Zalo Bot.';
  const p2 = 'Phần 2: Danh sách các lệnh tắt và công cụ AI hỗ trợ.';
  const text = `${p1}\n\n${p2}`;

  const chunks = splitMessage(text, 60);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0], p1);
  assert.equal(chunks[1], p2);
});

void test('splitMessage splits long text on single newlines when no double newline', () => {
  const l1 = 'Dòng 1: Ghi nhận thu chi';
  const l2 = 'Dòng 2: Quản lý công nợ';
  const l3 = 'Dòng 3: Google Calendar';
  const text = `${l1}\n${l2}\n${l3}`;

  const chunks = splitMessage(text, 35);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) {
    assert.ok(c.length <= 35);
  }
});

void test('splitMessage splits long text on spaces when no newlines', () => {
  const text = 'Một hai ba bốn năm sáu bảy tám chín mười mười một mười hai';
  const chunks = splitMessage(text, 25);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) {
    assert.ok(c.length <= 25);
  }
});

void test('splitMessage hard splits long string with no separators', () => {
  const text = 'A'.repeat(50);
  const chunks = splitMessage(text, 20);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 20);
  assert.equal(chunks[1].length, 20);
  assert.equal(chunks[2].length, 10);
});

void test('splitMessage handles realistic 3300+ character help text and ensures each chunk <= 1900', () => {
  const longText = Array(35)
    .fill('• /finance - Báo cáo thu chi hôm nay và phân tích số dư chi tiết của người dùng\n')
    .join('\n');
  assert.ok(longText.length > 2500);

  const chunks = splitMessage(longText, 1900);
  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 1900);
  }
});
