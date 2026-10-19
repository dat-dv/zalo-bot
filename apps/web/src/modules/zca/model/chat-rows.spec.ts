import assert from 'node:assert/strict';
import test from 'node:test';
import { GrantAccessStatus, UserRole, type IUserListItem } from '@zalobot/contracts';
import type { ZcaThread } from '../api/zca-api';
import {
  buildChatRows,
  countChatRows,
  matchesChatRowFilter,
  matchesChatRowSearch,
  sortChatRows,
} from './chat-rows';

function makeUser(overrides: Partial<IUserListItem> & { id: string }): IUserListItem {
  return {
    role: UserRole.USER,
    grantAccess: GrantAccessStatus.DENIED,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const threads: ZcaThread[] = [
  { id: 'g-1', name: 'Nhóm Dự Án', type: 'group', isListened: true, totalMembers: 12 },
  { id: '100', name: 'Anh Nam', type: 'user', isListened: false, phoneNumber: '0901234567' },
  { id: '200', name: 'Chị Linh', type: 'user', isListened: true },
];

const users: IUserListItem[] = [
  makeUser({ id: '100', firstName: 'Nam', grantAccess: GrantAccessStatus.GRANTED }),
  makeUser({ id: 'effcda102859c1079848', firstName: 'Bot Webhook User' }),
  makeUser({ id: '300', firstName: 'Admin', role: UserRole.ADMIN }),
];

void test('buildChatRows joins personal threads with users by id and keeps user-only rows', () => {
  const rows = buildChatRows(threads, users);
  const byId = new Map(rows.map((row) => [row.id, row]));

  assert.equal(rows.length, 5);
  assert.equal(byId.get('g-1')?.kind, 'group');
  assert.equal(byId.get('g-1')?.access, 'n/a');
  assert.equal(byId.get('100')?.kind, 'personal');
  assert.equal(byId.get('100')?.access, 'granted');
  assert.equal(byId.get('100')?.name, 'Anh Nam');
  assert.equal(byId.get('200')?.access, 'none');
  assert.equal(byId.get('effcda102859c1079848')?.kind, 'user-only');
  assert.equal(byId.get('effcda102859c1079848')?.access, 'pending');
  assert.equal(byId.get('300')?.access, 'admin');
});

void test('group ids never become user rows even if a users record shares the id', () => {
  const rows = buildChatRows(threads, [makeUser({ id: 'g-1' })]);
  const groupRows = rows.filter((row) => row.id === 'g-1');
  assert.equal(groupRows.length, 1);
  assert.equal(groupRows[0]?.kind, 'group');
  assert.equal(groupRows[0]?.user, undefined);
});

void test('filters split listening and interaction access', () => {
  const rows = buildChatRows(threads, users);
  const ids = (filter: Parameters<typeof matchesChatRowFilter>[1]) =>
    rows.filter((row) => matchesChatRowFilter(row, filter)).map((row) => row.id);

  assert.deepEqual(ids('listened'), ['g-1', '200']);
  assert.deepEqual(ids('pending'), ['200', 'effcda102859c1079848']);
  assert.deepEqual(ids('granted'), ['100', '300']);
  assert.deepEqual(ids('admin'), ['300']);
  assert.deepEqual(countChatRows(rows), {
    all: 5,
    listened: 2,
    group: 1,
    personal: 4,
    pending: 2,
    granted: 2,
    admin: 1,
  });
});

void test('search matches accent-insensitive names, phone and id', () => {
  const rows = buildChatRows(threads, users);
  const search = (query: string) =>
    rows.filter((row) => matchesChatRowSearch(row, query)).map((row) => row.id);

  assert.deepEqual(search('du an'), ['g-1']);
  assert.deepEqual(search('0901'), ['100']);
  assert.deepEqual(search('effcda'), ['effcda102859c1079848']);
});

void test('pending_first sort puts users awaiting approval on top', () => {
  const rows = sortChatRows(buildChatRows(threads, users), 'pending_first');
  assert.equal(rows[0]?.id, 'effcda102859c1079848');
  assert.equal(rows[1]?.id, '200');
  assert.equal(rows.at(-1)?.id, 'g-1');
});
