import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SEARCH_KEYWORDS,
  buildHitQuery,
  buildNeighbourQuery,
  buildVectorHitQuery,
  AUTO_RECALL_MAX_DISTANCE,
  meaningfulWordCount,
  mergeRankedIds,
  normalizeDate,
  parseKeywords,
  searchTerms,
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
  // The keywords, then the single words of the multi-word ones, all bound as params.
  assert.deepEqual(query.params, [
    'g-1',
    'đi',
    "Đà Lạt'",
    'DROP TABLE x',
    // "Đà" folds to "da" like the stop word "đã"; "Lạt" still finds Đà Lạt.
    "Lạt'",
    'DROP',
    'TABLE',
    15,
  ]);
  assert.doesNotMatch(query.sql, /sent_at >=/);
});

void test('searchTerms adds the words of multi-word keywords and literal patterns', () => {
  assert.deepEqual(searchTerms('tài khoản admin, c.datintech.site, có nói, mk'), {
    phrases: ['tài khoản admin', 'c.datintech.site', 'có nói', 'mk'],
    // "có" and "nói" alone would match almost every message.
    words: ['tài', 'khoản', 'admin'],
    patterns: ['%c.datintech.site%'],
  });
  assert.deepEqual(searchTerms('50%_off.vn').patterns, ['%50\\%\\_off.vn%']);
});

void test('buildHitQuery also matches domains as text and ranks those hits first', () => {
  const query = buildHitQuery('g-1', {
    keywords: 'c.datintech.site, admin',
    limit: 15,
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  assert.ok(query);
  assert.deepEqual(query.params, ['g-1', 'c.datintech.site', 'admin', ['%c.datintech.site%'], 15]);
  assert.match(query.sql, /\(m\.search_vector @@ q\.query OR m\.text ILIKE ANY\(\$4::text\[\]\)\)/);
  assert.match(query.sql, /ORDER BY \(m\.text ILIKE ANY\(\$4::text\[\]\)\) DESC, ts_rank/);
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

void test('buildVectorHitQuery ranks by cosine distance within the chat, model and dates', () => {
  const query = buildVectorHitQuery('g-1', [0.5, -0.25], 'minilm', {
    keywords: '',
    fromDate: '2026-05-01',
    limit: 9,
    timeZone: 'Asia/Ho_Chi_Minh',
    excludeMsgId: 'm-q',
  });
  assert.deepEqual(query.params, [
    'g-1',
    '[0.5,-0.25]',
    'minilm',
    'm-q',
    'Asia/Ho_Chi_Minh',
    '2026-05-01',
    9,
  ]);
  assert.match(query.sql, /e\.channel_id = \$1 AND e\.model = \$3/);
  assert.match(query.sql, /\(e\.embedding <=> \$2::vector\) < 0\.6/);
  assert.match(query.sql, /NOT m\.is_bot/);
  assert.match(query.sql, /m\.msg_id <> \$4/);
  assert.match(query.sql, /ORDER BY e\.embedding <=> \$2::vector ASC/);
  assert.match(query.sql, /LIMIT \$7$/);
});

void test('buildVectorHitQuery narrows the distance and the time when asked', () => {
  const since = new Date('2026-11-16T10:00:00Z');
  const query = buildVectorHitQuery(
    'g-1',
    [0.5],
    'minilm',
    { keywords: '', limit: 4, timeZone: 'UTC', excludeMsgId: 'm-q' },
    { maxDistance: AUTO_RECALL_MAX_DISTANCE, since },
  );
  assert.deepEqual(query.params, ['g-1', '[0.5]', 'minilm', 'm-q', since, 4]);
  assert.match(query.sql, /\(e\.embedding <=> \$2::vector\) < 0\.45/);
  assert.match(query.sql, /m\.sent_at >= \$5/);
  assert.match(query.sql, /LIMIT \$6$/);
});

void test('meaningfulWordCount skips stop words and single letters', () => {
  assert.equal(meaningfulWordCount('ừa'), 1);
  assert.equal(meaningfulWordCount('có gì k'), 0);
  assert.equal(meaningfulWordCount('ở quê có thẻ nhớ k ?'), 3);
  assert.equal(meaningfulWordCount(''), 0);
});

void test('mergeRankedIds puts ids found by both searches first and caps the list', () => {
  assert.deepEqual(
    mergeRankedIds(
      [
        ['a', 'b', 'c'],
        ['c', 'd'],
      ],
      10,
    ),
    ['c', 'a', 'b', 'd'],
  );
  assert.deepEqual(mergeRankedIds([['a', 'b'], []], 1), ['a']);
  assert.deepEqual(mergeRankedIds([[], []], 5), []);
});
