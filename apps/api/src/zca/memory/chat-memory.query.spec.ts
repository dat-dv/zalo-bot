import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SEARCH_KEYWORDS,
  buildHitQuery,
  buildNeighbourQuery,
  normalizeDate,
  parseKeywords,
} from './chat-memory.query';

void test('parseKeywords splits, trims, dedupes and caps keywords', () => {
  assert.deepEqual(parseKeywords('đi, du lịch ;Đi\n vé , a, '), ['đi', 'du lịch', 'vé']);
  const many = Array.from({ length: 20 }, (_, i) => `kw${i}`).join(',');
  assert.equal(parseKeywords(many).length, MAX_SEARCH_KEYWORDS);
});

void test('normalizeDate accepts only valid YYYY-MM-DD', () => {
  assert.equal(normalizeDate(' 2025-01-01 '), '2025-01-01');
  assert.equal(normalizeDate('2025-1-1'), undefined);
  assert.equal(normalizeDate('2025-13-40'), undefined);
  assert.equal(normalizeDate(undefined), undefined);
});

void test('buildHitQuery always scopes by channel and binds keywords as params', () => {
  const query = buildHitQuery('g-1', {
    keywords: "đi, Đà Lạt'; DROP TABLE x",
    limit: 15,
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  assert.ok(query);
  assert.match(query.sql, /m\.channel_id = \$1/);
  assert.match(query.sql, /m\.recalled_at IS NULL/);
  assert.doesNotMatch(query.sql, /DROP TABLE/);
  assert.deepEqual(query.params, ['g-1', 'đi', "Đà Lạt'", 'DROP TABLE x', 15]);
  assert.doesNotMatch(query.sql, /sent_at >=/);
});

void test('buildHitQuery adds an inclusive local date range', () => {
  const query = buildHitQuery('g-1', {
    keywords: 'đi',
    fromDate: '2025-01-01',
    toDate: '2025-12-31',
    limit: 10,
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  assert.ok(query);
  assert.deepEqual(query.params, ['g-1', 'đi', 'Asia/Ho_Chi_Minh', '2025-01-01', '2025-12-31', 10]);
  assert.match(query.sql, /m\.sent_at >= \(\$4::date\)::timestamp AT TIME ZONE \$3/);
  assert.match(query.sql, /m\.sent_at < \(\(\$5::date\) \+ 1\)::timestamp AT TIME ZONE \$3/);
});

void test('buildHitQuery returns null without usable keywords', () => {
  assert.equal(buildHitQuery('g-1', { keywords: ' , a', limit: 5, timeZone: 'UTC' }), null);
});

void test('buildNeighbourQuery keeps neighbours inside the channel', () => {
  const query = buildNeighbourQuery('g-1', ['id-1', 'id-2']);
  assert.deepEqual(query.params, ['g-1', ['id-1', 'id-2']]);
  assert.match(query.sql, /hit\.channel_id = \$1/);
  assert.match(query.sql, /p\.channel_id = \$1/);
  assert.match(query.sql, /n\.channel_id = \$1/);
});

void test('buildHitQuery never counts bot replies or the asking message as hits', () => {
  const query = buildHitQuery('g-1', {
    keywords: 'vé',
    limit: 5,
    timeZone: 'UTC',
    excludeMsgId: 'm-question',
  });

  assert.ok(query);
  assert.match(query.sql, /NOT m\.is_bot/);
  assert.match(query.sql, /m\.msg_id <> \$3/);
  assert.deepEqual(query.params, ['g-1', 'vé', 'm-question', 5]);
});
