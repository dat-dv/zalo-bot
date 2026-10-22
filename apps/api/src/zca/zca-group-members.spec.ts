import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGroupMembers,
  parseGroupMembersCache,
  readGroupInfo,
  readMemberProfiles,
  stripMemberVersion,
} from './zca-group-members';

void test('stripMemberVersion drops the Zalo version suffix', () => {
  assert.equal(stripMemberVersion('123456_0'), '123456');
  assert.equal(stripMemberVersion('123456'), '123456');
});

void test('readGroupInfo reads unique member ids and the member count of one group', () => {
  const response = {
    gridInfoMap: {
      'g-1': { memVerList: ['111_0', '222_3', '111_1', 5], totalMember: 3 },
    },
  };

  assert.deepEqual(readGroupInfo(response, 'g-1'), { memberIds: ['111', '222'], totalMembers: 3 });
  assert.equal(readGroupInfo(response, 'g-2'), null);
  assert.equal(readGroupInfo(null, 'g-1'), null);
});

void test('readMemberProfiles maps profiles by uid and falls back to the Zalo name', () => {
  const profiles = readMemberProfiles({
    profiles: {
      '111_0': { id: '111', displayName: 'Nam', zaloName: 'Nam Nguyễn', avatar: 'https://a/1.jpg' },
      '222_0': { displayName: '', zaloName: 'Lan' },
      bad: 'not-a-profile',
    },
  });

  assert.deepEqual(profiles.get('111'), {
    id: '111',
    displayName: 'Nam',
    zaloName: 'Nam Nguyễn',
    avatar: 'https://a/1.jpg',
  });
  assert.deepEqual(profiles.get('222'), { id: '222', displayName: 'Lan' });
  assert.equal(profiles.size, 2);
});

void test('buildGroupMembers keeps the member order and lists unknown profiles by uid', () => {
  const profiles = readMemberProfiles({ profiles: { '222': { id: '222', displayName: 'Lan' } } });
  assert.deepEqual(buildGroupMembers(['111', '222'], profiles), [
    { id: '111', displayName: '111' },
    { id: '222', displayName: 'Lan' },
  ]);
});

void test('parseGroupMembersCache accepts the stored shape and rejects garbage', () => {
  const stored = JSON.stringify({
    members: [{ id: '111', displayName: 'Nam' }, { displayName: 'no id' }],
    totalMembers: 2,
    fetchedAt: 42,
  });

  assert.deepEqual(parseGroupMembersCache(stored), {
    members: [{ id: '111', displayName: 'Nam' }],
    totalMembers: 2,
    fetchedAt: 42,
  });
  assert.equal(parseGroupMembersCache('{not json'), null);
  assert.equal(parseGroupMembersCache(null), null);
});
