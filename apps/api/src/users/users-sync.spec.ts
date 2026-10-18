import test from 'node:test';
import assert from 'node:assert/strict';
import { UsersService } from './users.service';
import type { UserEntity } from '../database/entities/user.entity';
import type { ZcaService } from '../zca/zca.service';
import type { Repository } from 'typeorm';

void test('UsersService.syncUsersWithZca enriches users matching ZCA threads', async () => {
  const users: UserEntity[] = [
    {
      id: 'zca_user_1',
      firstName: 'Người dùng Zalo',
      role: 'user',
      grantAccess: 1,
    } as UserEntity,
    {
      id: 'other_user',
      firstName: 'Custom Name',
      role: 'user',
      grantAccess: 1,
    } as UserEntity,
  ];

  const savedUsers: UserEntity[] = [];
  const mockRepo = {
    find: () => Promise.resolve(users),
    findOne: ({ where }: { where: { id: string } }) =>
      Promise.resolve(users.find((u) => u.id === where.id) || null),
    save: (entity: UserEntity) => {
      savedUsers.push(entity);
      return Promise.resolve(entity);
    },
  } as unknown as Repository<UserEntity>;

  const mockZcaService = {
    getAvailableThreads: () =>
      Promise.resolve([
        {
          id: 'zca_user_1',
          name: 'Anh Nam Zalo',
          displayName: 'Nam Nguyen',
          alias: 'Nam Kế Toán',
          phoneNumber: '0901234567',
          avatar: 'https://zalo.me/avatar/nam.jpg',
          type: 'user',
          isListened: true,
        },
      ]),
  } as unknown as ZcaService;

  const service = new UsersService(mockRepo, undefined, mockZcaService);
  const result = await service.syncUsersWithZca();

  assert.equal(result.syncedCount, 1);
  assert.equal(result.totalUsers, 2);
  assert.equal(savedUsers.length, 1);
  assert.equal(savedUsers[0].id, 'zca_user_1');
  assert.equal(savedUsers[0].avatarUrl, 'https://zalo.me/avatar/nam.jpg');
  assert.equal(savedUsers[0].phoneNumber, '0901234567');
  // Alias or name took precedence over generic placeholder
  assert.equal(savedUsers[0].firstName, 'Nam Kế Toán');
});

void test('UsersService.updateUserProfile updates user display name and phone number', async () => {
  let savedUser: UserEntity | null = null;
  const mockRepo = {
    findOne: () =>
      Promise.resolve({
        id: 'bot_scoped_user_99',
        firstName: 'Người dùng Zalo',
        role: 'user',
      } as UserEntity),
    save: (entity: UserEntity) => {
      savedUser = entity;
      return Promise.resolve(entity);
    },
  } as unknown as Repository<UserEntity>;

  const service = new UsersService(mockRepo);
  const updated = await service.updateUserProfile('bot_scoped_user_99', {
    firstName: 'Chị Mai Giám Đốc',
    phoneNumber: '0988776655',
  });

  assert.ok(updated);
  assert.equal(updated.firstName, 'Chị Mai Giám Đốc');
  assert.equal(updated.phoneNumber, '0988776655');
  assert.equal(savedUser?.firstName, 'Chị Mai Giám Đốc');
});
