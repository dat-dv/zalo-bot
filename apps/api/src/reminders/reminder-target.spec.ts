import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReminderMessage, isSameTarget, normalizeTargetUsers } from './reminder-target';

void test('buildReminderMessage tags each user on the line after the header', () => {
  const { text, mentions } = buildReminderMessage('⏰ Nhắc', '📌 Họp', [
    { id: '1', name: 'Trí' },
    { id: '2', name: 'Đạt Đoàn' },
  ]);
  assert.equal(text, '⏰ Nhắc\n@Trí @Đạt Đoàn\n📌 Họp');
  for (const mention of mentions) {
    assert.equal(text.slice(mention.pos, mention.pos + mention.len)[0], '@');
  }
  assert.deepEqual(
    mentions.map((m) => text.slice(m.pos, m.pos + m.len)),
    ['@Trí', '@Đạt Đoàn'],
  );
  assert.deepEqual(
    mentions.map((m) => m.uid),
    ['1', '2'],
  );
});

void test('buildReminderMessage without users has no tag line', () => {
  assert.deepEqual(buildReminderMessage('H', 'B'), { text: 'H\nB', mentions: [] });
});

void test('normalizeTargetUsers trims, de-duplicates and caps at 10', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `U${i}` }));
  assert.equal(normalizeTargetUsers(many).length, 10);
  assert.deepEqual(
    normalizeTargetUsers([
      { id: ' 1 ', name: ' Trí ' },
      { id: '1', name: 'again' },
      { id: '2', name: ' ' },
      { id: '', name: 'nobody' },
    ]),
    [
      { id: '1', name: 'Trí' },
      { id: '2', name: '2' },
    ],
  );
});

void test('isSameTarget compares chat, mode and the set of people', () => {
  const base = { chatId: 'g1', mode: 'mention' as const, users: [{ id: '1', name: 'A' }] };
  assert.equal(isSameTarget(base, { ...base, users: [{ id: '1', name: 'renamed' }] }), true);
  assert.equal(isSameTarget(base, { ...base, mode: 'direct' }), false);
  assert.equal(isSameTarget(base, { ...base, chatId: 'g2' }), false);
  assert.equal(isSameTarget(base, { ...base, users: [] }), false);
  assert.equal(isSameTarget(null, null), true);
  assert.equal(isSameTarget(base, null), false);
});
