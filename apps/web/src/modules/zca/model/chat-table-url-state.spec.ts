import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CHAT_TABLE_STATE,
  parseChatTableState,
  toChatTableQuery,
} from './chat-table-url-state';

test('parseChatTableState reads every known value', () => {
  const state = parseChatTableState(
    new URLSearchParams('q=Nam&filter=group&sort=name_desc&page=3&size=50'),
  );

  assert.deepEqual(state, {
    search: 'Nam',
    filter: 'group',
    sortBy: 'name_desc',
    page: 3,
    pageSize: 50,
  });
});

test('parseChatTableState falls back to defaults for unknown or malformed values', () => {
  const state = parseChatTableState(
    new URLSearchParams('filter=everyone&sort=random&page=-2&size=7'),
  );

  assert.deepEqual(state, DEFAULT_CHAT_TABLE_STATE);
  assert.equal(parseChatTableState(new URLSearchParams('page=1.5')).page, 1);
  assert.equal(parseChatTableState(new URLSearchParams('page=0')).page, 1);
});

test('toChatTableQuery omits defaults and round-trips through the parser', () => {
  assert.equal(toChatTableQuery(DEFAULT_CHAT_TABLE_STATE), '');
  assert.equal(toChatTableQuery({ ...DEFAULT_CHAT_TABLE_STATE, search: '   ' }), '');

  const state = {
    search: 'Trí Đen',
    filter: 'pending',
    sortBy: 'pending_first',
    page: 2,
    pageSize: 10000,
  } as const;
  const query = toChatTableQuery(state);

  assert.equal(query.startsWith('?'), true);
  assert.deepEqual(parseChatTableState(new URLSearchParams(query.slice(1))), state);
});
