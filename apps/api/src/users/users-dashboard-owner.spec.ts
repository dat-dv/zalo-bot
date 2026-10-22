import test from 'node:test';
import assert from 'node:assert/strict';
import { GrantAccessStatus, UserRole } from '@zalobot/contracts';
import { DASHBOARD_OWNER_USER_ID, UsersService } from './users.service';
import type { UserEntity } from '../database/entities/user.entity';
import type { Repository } from 'typeorm';

function createRepo(users: UserEntity[]): Repository<UserEntity> {
  return {
    findOne: ({ where }: { where: { id: string } }) =>
      Promise.resolve(users.find((u) => u.id === where.id) ?? null),
    create: (data: Partial<UserEntity>) => data as UserEntity,
    save: (entity: UserEntity) => {
      if (!users.includes(entity)) users.push(entity);
      return Promise.resolve(entity);
    },
  } as unknown as Repository<UserEntity>;
}

void test('ensureDashboardOwner creates the owner as a granted admin', async () => {
  const users: UserEntity[] = [];
  const service = new UsersService(createRepo(users));

  const owner = await service.ensureDashboardOwner();

  assert.equal(owner.id, DASHBOARD_OWNER_USER_ID);
  assert.equal(owner.role, UserRole.ADMIN);
  assert.equal(owner.grantAccess, GrantAccessStatus.GRANTED);
  assert.equal(owner.firstName, 'Chủ hệ thống');
  assert.equal(service.isAdmin(DASHBOARD_OWNER_USER_ID), true);
});

void test('ensureDashboardOwner restores admin rights and keeps a renamed owner name', async () => {
  const users = [
    {
      id: DASHBOARD_OWNER_USER_ID,
      firstName: 'Anh Đạt',
      role: UserRole.USER,
      grantAccess: GrantAccessStatus.DENIED,
    } as UserEntity,
  ];
  const service = new UsersService(createRepo(users));

  const owner = await service.ensureDashboardOwner();

  assert.equal(owner.role, UserRole.ADMIN);
  assert.equal(owner.grantAccess, GrantAccessStatus.GRANTED);
  assert.equal(owner.firstName, 'Anh Đạt');
});
