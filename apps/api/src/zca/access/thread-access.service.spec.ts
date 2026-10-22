import test from 'node:test';
import assert from 'node:assert/strict';
import type { ThreadBotConfig, ThreadMemberAccessConfig } from '@zalobot/contracts';
import { createDefaultThreadConfig } from '../thread-config.service';
import { GroupMemberAccessPolicy } from './group-member-access.policy';
import { PersonalAccessPolicy } from './personal-access.policy';
import { ThreadAccessService } from './thread-access.service';

function groupConfig(memberAccess: ThreadMemberAccessConfig): ThreadBotConfig {
  return { ...createDefaultThreadConfig('g-1', { threadType: 'group' }), memberAccess };
}

void test('GroupMemberAccessPolicy follows the member access mode', () => {
  const policy = new GroupMemberAccessPolicy();

  assert.equal(
    policy.allows('u-1', groupConfig({ mode: 'granted-users', memberIds: ['u-1'] })),
    false,
  );
  assert.equal(policy.allows('u-1', groupConfig({ mode: 'all-members', memberIds: [] })), true);
  assert.equal(
    policy.allows('u-1', groupConfig({ mode: 'selected-members', memberIds: ['u-1'] })),
    true,
  );
  assert.equal(
    policy.allows('u-2', groupConfig({ mode: 'selected-members', memberIds: ['u-1'] })),
    false,
  );
});

void test('PersonalAccessPolicy never grants access of its own', () => {
  const config = {
    ...createDefaultThreadConfig('u-1'),
    memberAccess: { mode: 'all-members' as const, memberIds: [] as string[] },
  };
  assert.equal(new PersonalAccessPolicy().allows(), false);
  assert.equal(new ThreadAccessService().grantsThreadAccess('u-1', config, 'user'), false);
});

void test('ThreadAccessService picks the policy by the message kind, not the stored thread type', () => {
  const service = new ThreadAccessService();
  // An older row may still say 'user' for a numeric group id.
  const config: ThreadBotConfig = {
    ...createDefaultThreadConfig('123456', { threadType: 'user' }),
    memberAccess: { mode: 'selected-members', memberIds: ['u-1'] },
  };

  assert.equal(service.grantsThreadAccess('u-1', config, 'group'), true);
  assert.equal(service.grantsThreadAccess('u-2', config, 'group'), false);
  assert.equal(
    service.grantsThreadAccess('', groupConfig({ mode: 'all-members', memberIds: [] }), 'group'),
    false,
  );
});
