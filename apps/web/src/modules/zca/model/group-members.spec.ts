import assert from 'node:assert/strict';
import test from 'node:test';
import { GrantAccessStatus, UserRole, type IUserListItem } from '@zalobot/contracts';
import { buildGroupMemberRows, filterGroupMemberRows, setMemberSelected } from './group-members';

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

const members = [
  { id: '111', displayName: 'Nguyễn Nam', zaloName: 'Nam Zalo' },
  { id: '222', displayName: 'Lan' },
  { id: '333', displayName: 'Admin' },
];
const users = [
  makeUser({ id: '222', grantAccess: GrantAccessStatus.GRANTED }),
  makeUser({ id: '333', role: UserRole.ADMIN }),
  makeUser({ id: '999', firstName: 'Đã rời' }),
];

test('buildGroupMemberRows marks global access, selection and members who left', () => {
  const rows = buildGroupMemberRows(members, users, ['111', '999']);

  assert.deepEqual(
    rows.map((row) => [row.id, row.globalAccess, row.isSelected, row.hasLeft]),
    [
      ['111', 'none', true, false],
      ['222', 'granted', false, false],
      ['333', 'admin', false, false],
      ['999', 'none', true, true],
    ],
  );
  assert.equal(rows[3].displayName, 'Đã rời');
});

test('filterGroupMemberRows searches without diacritics and filters selected rows', () => {
  const rows = buildGroupMemberRows(members, users, ['111']);

  assert.deepEqual(
    filterGroupMemberRows(rows, 'nam', 'all').map((row) => row.id),
    ['111'],
  );
  assert.deepEqual(
    filterGroupMemberRows(rows, '22', 'all').map((row) => row.id),
    ['222'],
  );
  assert.deepEqual(
    filterGroupMemberRows(rows, '', 'selected').map((row) => row.id),
    ['111'],
  );
});

test('setMemberSelected adds and removes an id once', () => {
  assert.deepEqual(setMemberSelected(['111'], '222', true), ['111', '222']);
  assert.deepEqual(setMemberSelected(['111', '222'], '111', true), ['222', '111']);
  assert.deepEqual(setMemberSelected(['111', '222'], '111', false), ['222']);
});
