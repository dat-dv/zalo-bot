import test from 'node:test';
import assert from 'node:assert/strict';
import { GrantAccessStatus, UserRole } from '@zalobot/contracts';
import { DASHBOARD_OWNER_USER_ID, UsersService } from './users.service';
import type { UserEntity } from '../database/entities/user.entity';
import type { Repository } from 'typeorm';
import type { AvailableThread, ZcaService } from '../zca/zca.service';

function createRepo(users: Partial<UserEntity>[]): Repository<UserEntity> {
  return {
    findOne: ({ where }: { where: { id: string } }) =>
      Promise.resolve(users.find((u) => u.id === where.id) ?? null),
    create: (data: Partial<UserEntity>) => data,
    save: (entity: Partial<UserEntity>) => {
      if (!users.includes(entity)) users.push(entity);
      return Promise.resolve(entity);
    },
  } as unknown as Repository<UserEntity>;
}

function createZca(threads: Partial<AvailableThread>[]): ZcaService {
  return {
    getOwnId: (): string | undefined => undefined,
    getAvailableThreads: () => Promise.resolve(threads),
  } as unknown as ZcaService;
}

void test('getSessionProfile prefers the ZCA directory name and avatar', async () => {
  const users: Partial<UserEntity>[] = [{ id: '42', firstName: 'Old name', role: UserRole.USER }];
  const zca = createZca([
    { id: '42', type: 'user', name: 'Đạt Đoàn', alias: 'Anh Đạt', avatar: 'https://a/1.png' },
    { id: '42', type: 'group', name: 'Same id group' },
  ]);
  const service = new UsersService(createRepo(users), undefined, zca);

  const profile = await service.getSessionProfile(42);

  assert.deepEqual(profile, {
    id: '42',
    name: 'Anh Đạt',
    avatarUrl: 'https://a/1.png',
    isAdmin: false,
    isDashboardOwner: false,
  });
});

void test('getSessionProfile falls back to firstName, then to no name', async () => {
  const users: Partial<UserEntity>[] = [
    { id: '7', firstName: 'Lan', avatarUrl: 'https://a/7.png' },
  ];
  const service = new UsersService(createRepo(users), undefined, createZca([]));

  assert.deepEqual(await service.getSessionProfile('7'), {
    id: '7',
    name: 'Lan',
    avatarUrl: 'https://a/7.png',
    isAdmin: false,
    isDashboardOwner: false,
  });
  assert.equal((await service.getSessionProfile('unknown')).name, null);
});

void test('getSessionProfile marks the dashboard owner as an admin without its default name', async () => {
  const service = new UsersService(createRepo([]));
  await service.ensureDashboardOwner();

  const profile = await service.getSessionProfile(DASHBOARD_OWNER_USER_ID);

  assert.equal(profile.isDashboardOwner, true);
  assert.equal(profile.isAdmin, true);
  assert.equal(profile.name, null);
});

void test('getSessionProfile keeps a renamed dashboard owner name', async () => {
  const users: Partial<UserEntity>[] = [
    {
      id: DASHBOARD_OWNER_USER_ID,
      firstName: 'Anh Đạt',
      role: UserRole.ADMIN,
      grantAccess: GrantAccessStatus.GRANTED,
    },
  ];
  const service = new UsersService(createRepo(users));

  assert.equal((await service.getSessionProfile(DASHBOARD_OWNER_USER_ID)).name, 'Anh Đạt');
});
