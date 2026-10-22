import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import type { ReminderTarget } from './reminder-target';
import { createTargetService } from './reminder-target.fixtures.spec';

void test('listChannels lists listened threads, plus the private chat of Zalo users', async () => {
  const { service } = createTargetService();
  assert.deepEqual(await service.listChannels('dashboard-owner'), [
    { id: 'g1', name: 'Nhà mình', type: 'group' },
    { id: 'g3', name: 'Công ty', type: 'group' },
  ]);
  assert.deepEqual((await service.listChannels('111'))[0], {
    id: '111',
    name: '111',
    type: 'user',
    isSelf: true,
  });
});

void test('listMembers only serves listened groups', async () => {
  const { service } = createTargetService();
  assert.deepEqual(await service.listMembers('g1'), [
    { id: '111', name: 'Đạt' },
    { id: '222', name: 'Trí' },
  ]);
  await assert.rejects(service.listMembers('g2'), BadRequestException);
});

void test('the default chat is where the bot was asked (origin) or the own chat (self)', async () => {
  const { service } = createTargetService();
  const actor = { userId: '111', chatId: 'g1' };
  assert.equal((await service.resolve({}, null, actor, 'origin')).chatId, 'g1');
  assert.equal((await service.resolve({}, null, actor, 'self')).chatId, '111');
});

void test('dashboard-owner has no default chat and may only pick a listened one', async () => {
  const { service } = createTargetService();
  const owner = { userId: 'dashboard-owner' };
  await assert.rejects(service.resolve({}, null, owner, 'self'), BadRequestException);
  await assert.rejects(service.resolve({ chatId: 'g2' }, null, owner, 'self'), BadRequestException);
  assert.equal((await service.resolve({ chatId: 'g1' }, null, owner, 'self')).chatId, 'g1');
});

void test('picked people must be group members and are named from the member list', async () => {
  const { service } = createTargetService();
  const actor = { userId: '111' };
  const target = await service.resolve(
    { chatId: 'g1', userIds: ['222'], mode: 'direct' },
    null,
    actor,
    'self',
  );
  assert.deepEqual(target, { chatId: 'g1', users: [{ id: '222', name: 'Trí' }], mode: 'direct' });
  await assert.rejects(
    service.resolve({ chatId: 'g1', userIds: ['999'] }, null, actor, 'self'),
    BadRequestException,
  );
});

void test('a private chat has no people; moving to another group drops them', async () => {
  const { service } = createTargetService();
  const actor = { userId: '111' };
  const own = await service.resolve(
    { chatId: '111', users: [{ id: '222', name: 'Trí' }] },
    null,
    actor,
    'self',
  );
  assert.deepEqual(own.users, []);
  const current = { chatId: 'g1', users: [{ id: '222', name: 'Trí' }], mode: 'direct' as const };
  const kept = await service.resolve({}, current, actor, 'self');
  assert.deepEqual(kept, current);
  const moved = await service.resolve({ chatId: 'g3' }, current, actor, 'self');
  assert.deepEqual(moved, { chatId: 'g3', users: [], mode: 'mention' });
});

void test('deliver tags the people in one group message', async () => {
  const { service, sent } = createTargetService();
  const result = await service.deliver(
    { chatId: 'g1', users: [{ id: '222', name: 'Trí' }], mode: 'mention' },
    { header: 'H', body: 'B' },
    'vi',
  );
  assert.equal(result, 'sent');
  assert.deepEqual(sent, [{ chatId: 'g1', text: 'H\n@Trí\nB', tagged: ['222'] }]);
});

void test('direct messages each person; whoever cannot be reached is tagged in the group', async () => {
  const { service, sent } = createTargetService({ failPrivate: ['333'] });
  await service.deliver(
    {
      chatId: 'g1',
      users: [
        { id: '222', name: 'Trí' },
        { id: '333', name: 'Lan' },
      ],
      mode: 'direct',
    },
    { header: 'H', body: 'B' },
    'vi',
  );
  assert.deepEqual(sent, [
    { chatId: '222', text: 'H\nBạn được nhắc trong Nhà mình.\nB', tagged: [] },
    { chatId: 'g1', text: 'H\n@Lan\nB', tagged: ['333'] },
  ]);
});

void test('deliver skips unlistened groups and dashboard-owner', async () => {
  const { service, sent } = createTargetService();
  const message = { header: 'H', body: 'B' };
  const none: Omit<ReminderTarget, 'chatId'> = { users: [], mode: 'mention' };
  assert.equal(await service.deliver({ chatId: 'g2', ...none }, message, 'vi'), 'skipped');
  assert.equal(
    await service.deliver({ chatId: 'dashboard-owner', ...none }, message, 'vi'),
    'skipped',
  );
  assert.equal(sent.length, 0);
});
