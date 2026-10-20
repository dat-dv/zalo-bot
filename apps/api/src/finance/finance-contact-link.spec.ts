import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { UserEntity } from '../database/entities/user.entity';
import { toLinkedContactItems } from '../users/user-linked-contacts.service';

const ACTOR = '42';

function contact(overrides: Partial<DebtContactEntity> = {}): DebtContactEntity {
  return {
    id: 'c-1',
    displayName: 'Trí',
    normalizedName: 'tri',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function user(id: string): UserEntity {
  return { id, firstName: `User ${id}` } as UserEntity;
}

interface FindOneOptions {
  where: { id?: unknown; linkedUserId?: string };
}

/** contactRepo.findOne phục vụ cả getContact (theo id) lẫn kiểm tra trùng (theo linkedUserId). */
function createService(input: {
  existing: DebtContactEntity;
  users?: UserEntity[];
  duplicate?: DebtContactEntity | null;
}) {
  const saved: DebtContactEntity[] = [];
  const savedUsers: UserEntity[] = [];
  const service = new FinanceService(
    {} as never,
    {} as never,
    {
      findOne: (opts: FindOneOptions) =>
        Promise.resolve(
          opts.where.linkedUserId !== undefined ? (input.duplicate ?? null) : input.existing,
        ),
      save: (c: DebtContactEntity) => {
        saved.push(c);
        return Promise.resolve(c);
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      findOne: (opts: { where: { id: string } }) =>
        Promise.resolve((input.users ?? []).find((u) => u.id === opts.where.id) ?? null),
      save: (u: UserEntity) => {
        savedUsers.push(u);
        return Promise.resolve(u);
      },
    } as never,
  );
  return { service, saved, savedUsers };
}

function update(service: FinanceService, linkedUserId: string | null | undefined) {
  return service.updateContact(
    'c-1',
    'Trí',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    linkedUserId,
  );
}

void test('updateContact with null clears both the column and the loaded relation', async () => {
  const existing = contact({ linkedUserId: 'u-9', linkedUser: user('u-9') });
  const { service, saved } = createService({ existing });

  await update(service, null);

  assert.equal(saved[0].linkedUserId, null);
  assert.equal(saved[0].linkedUser, null);
});

void test('updateContact links an existing user and replaces the stale relation', async () => {
  const existing = contact({ linkedUserId: 'u-old', linkedUser: user('u-old') });
  const { service, saved } = createService({ existing, users: [user('u-9')] });

  await update(service, 'u-9');

  assert.equal(saved[0].linkedUserId, 'u-9');
  assert.equal(saved[0].linkedUser?.id, 'u-9');
});

void test('updateContact without linkedUserId keeps the current link', async () => {
  const existing = contact({ linkedUserId: 'u-9', linkedUser: user('u-9') });
  const { service, saved } = createService({ existing });

  await update(service, undefined);

  assert.equal(saved[0].linkedUserId, 'u-9');
});

void test('updateContact may link any existing user, including the one editing', async () => {
  // The contact directory is shared, so no account owns it and none is excluded from linking.
  const { service, saved } = createService({ existing: contact(), users: [user(ACTOR)] });

  await update(service, ACTOR);

  assert.equal(saved[0].linkedUserId, ACTOR);
});

void test('updateContact rejects an unknown user id', async () => {
  const { service } = createService({ existing: contact() });

  await assert.rejects(update(service, 'u-missing'), BadRequestException);
});

void test('updateContact rejects a user already linked to another contact in the shared directory', async () => {
  const { service } = createService({
    existing: contact(),
    users: [user('u-9')],
    duplicate: contact({ id: 'c-2', displayName: 'Trí Đen', linkedUserId: 'u-9' }),
  });

  await assert.rejects(update(service, 'u-9'), ConflictException);
});

function createController(isAdmin: boolean) {
  const calls: unknown[][] = [];
  const controller = new FinanceController(
    {
      updateContact: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve({});
      },
    } as never,
    {} as never,
    { isAdmin: () => isAdmin } as never,
    {} as never,
  );
  // actorId() is stubbed, so the request object itself is never read.
  Reflect.set(controller, 'actorId', () => ACTOR);
  return { controller, calls };
}

void test('PATCH /api/contacts/:id forbids non-admins from changing the linked user', async () => {
  const { controller, calls } = createController(false);

  await assert.rejects(
    controller.updateContact({} as Request, 'c-1', { displayName: 'Trí', linkedUserId: 'u-9' }),
    ForbiddenException,
  );
  await assert.rejects(
    controller.updateContact({} as Request, 'c-1', { displayName: 'Trí', linkedUserId: null }),
    ForbiddenException,
  );
  assert.equal(calls.length, 0);
});

void test('PATCH /api/contacts/:id lets non-admins edit other fields and passes null for admins', async () => {
  const member = createController(false);
  await member.controller.updateContact({} as Request, 'c-1', { displayName: 'Trí' });
  assert.equal(member.calls[0][9], undefined);

  const admin = createController(true);
  await admin.controller.updateContact({} as Request, 'c-1', {
    displayName: 'Trí',
    linkedUserId: null,
  });
  assert.equal(admin.calls[0][9], null);
});

void test('toLinkedContactItems maps aliases and debt counts', () => {
  const items = toLinkedContactItems(
    [
      contact({ id: 'c-1', alias: 'Trí Đen', linkedUserId: 'u-9' }),
      contact({ id: 'c-2', linkedUserId: 'u-9' }),
    ],
    new Map([['c-1', 3]]),
  );

  assert.deepEqual(
    items.map((i) => [i.contactId, i.alias, i.debtCount]),
    [
      ['c-1', 'Trí Đen', 3],
      ['c-2', undefined, 0],
    ],
  );
});

void test('linking backfills an empty contact phone from the user and never overwrites', async () => {
  const withPhone = { ...user('u-9'), phoneNumber: '0909' } as UserEntity;
  const { service, saved, savedUsers } = createService({
    existing: contact(),
    users: [withPhone],
  });

  await update(service, 'u-9');

  assert.equal(saved[0].phoneNumber, '0909');
  assert.equal(savedUsers.length, 0);
});

void test('linking backfills an empty user phone from the contact', async () => {
  const noPhone = user('u-9');
  const { service, saved, savedUsers } = createService({
    existing: contact({ phoneNumber: '0911' }),
    users: [noPhone],
  });

  await update(service, 'u-9');

  assert.equal(saved[0].phoneNumber, '0911');
  assert.equal(savedUsers[0]?.phoneNumber, '0911');
});
