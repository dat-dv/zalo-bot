import assert from 'node:assert/strict';
import test from 'node:test';
import { didStartListening, listenStartedSections } from './listen-started';

void test('didStartListening is true only when a save turns listening on', () => {
  assert.equal(didStartListening(false, true), true);
  assert.equal(didStartListening(true, true), false);
  assert.equal(didStartListening(true, false), false);
  assert.equal(didStartListening(false, false), false);
});

void test('listenStartedSections follows the memory switches of the chat', () => {
  const on = listenStartedSections({ enabled: true, readImageText: true, learnPeople: false });
  assert.deepEqual(
    on.map((section) => section.title),
    ['👂 Lắng nghe', '🧠 Nhớ lâu dài: đang bật', '🖼️ Đọc chữ trong ảnh: đang bật', '📌 Ghi nhớ'],
  );
  assert.ok(on[1].lines.some((line) => line.includes('/sync')));

  const off = listenStartedSections({ enabled: false, readImageText: true, learnPeople: false });
  assert.equal(off[1].title, '🧠 Nhớ lâu dài: đang tắt');
  assert.equal(
    off[2].title,
    '🖼️ Đọc chữ trong ảnh: không dùng',
    'photo text needs long-term memory',
  );
});
