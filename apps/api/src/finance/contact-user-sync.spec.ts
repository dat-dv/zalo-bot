import test from 'node:test';
import assert from 'node:assert/strict';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { UserEntity } from '../database/entities/user.entity';
import { fillMissingPhones, planContactUserSync, userDisplayName } from './contact-user-sync';
import { ContactUserSyncService } from './contact-user-sync.service';

const BOT = '999';
const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function user(id: string, firstName?: string, phoneNumber?: string): UserEntity {
  return { id, firstName, phoneNumber } as UserEntity;
}

function contact(overrides: Partial<DebtContactEntity>): DebtContactEntity {
  return {
    id: 'c-x',
    displayName: 'X',
    normalizedName: 'x',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

void test('fillMissingPhones only fills the empty side and never overwrites', () => {
  assert.deepEqual(fillMissingPhones(undefined, '0901'), { contactPhone: '0901' });
  assert.deepEqual(fillMissingPhones('  ', '0901'), { contactPhone: '0901' });
  assert.deepEqual(fillMissingPhones('0902', null), { userPhone: '0902' });
  assert.deepEqual(fillMissingPhones('0902', '0901'), {});
  assert.deepEqual(fillMissingPhones(undefined, undefined), {});
});

void test('userDisplayName falls back to username, then the id tail', () => {
  assert.equal(userDisplayName(user('123456', 'Trí')), 'Trí');
  assert.equal(userDisplayName({ id: '123456', username: 'tri.n' } as UserEntity), 'tri.n');
  assert.equal(userDisplayName(user('123456')), 'Zalo 3456');
});

void test('planContactUserSync creates, keeps linked, suggests same-name and skips the bot', () => {
  const plan = planContactUserSync({
    users: [user(BOT, 'Bot'), user('10', 'Nam'), user('11', 'Trí'), user('12', 'Hùng')],
    contacts: [
      contact({ id: 'c-tri', displayName: 'Trí', normalizedName: 'tri', alias: 'Đen' }),
      contact({ id: 'c-hung', displayName: 'Hùng', normalizedName: 'hung', linkedUserId: '12' }),
    ],
    isBotAccount: (id) => id === BOT,
    normalize,
  });

  assert.deepEqual(
    plan.create.map((c) => [c.user.id, c.displayName]),
    [['10', 'Nam']],
  );
  assert.deepEqual(
    plan.linked.map((l) => [l.user.id, l.contact.id]),
    [['12', 'c-hung']],
  );
  assert.deepEqual(plan.suggestions, [
    { userId: '11', userName: 'Trí', contactId: 'c-tri', contactName: 'Trí (Đen)' },
  ]);
});

void test('planContactUserSync creates a new contact when the same-name contact is linked to someone else', () => {
  const plan = planContactUserSync({
    users: [user('11', 'Trí')],
    contacts: [contact({ id: 'c-tri', normalizedName: 'tri', linkedUserId: '77' })],
    isBotAccount: () => false,
    normalize,
  });
  assert.equal(plan.create.length, 1);
  assert.equal(plan.suggestions.length, 0);
});

void test('syncUsersIntoContacts saves new linked contacts, fills phones and is idempotent', async () => {
  const contacts: DebtContactEntity[] = [
    contact({ id: 'c-hung', displayName: 'Hùng', normalizedName: 'hung', linkedUserId: '12' }),
  ];
  const users = [user('10', 'Nam', '0901'), user('12', 'Hùng', '0912')];
  const savedUsers: UserEntity[] = [];
  const service = new ContactUserSyncService(
    {
      find: () => Promise.resolve([...contacts]),
      create: (data: Partial<DebtContactEntity>) => ({ id: `c-${data.linkedUserId}`, ...data }),
      save: (rows: DebtContactEntity[]) => {
        for (const row of rows) {
          if (!contacts.includes(row)) contacts.push(row);
        }
        return Promise.resolve(rows);
      },
    } as never,
    {
      find: () => Promise.resolve(users),
      save: (rows: UserEntity[]) => {
        savedUsers.push(...rows);
        return Promise.resolve(rows);
      },
    } as never,
    { normalizeIdentity: normalize } as never,
    { isBotAccount: () => false } as never,
  );

  const first = await service.syncUsersIntoContacts();
  assert.deepEqual(first, { created: 1, phoneFilled: 2, suggestions: [] });
  const nam = contacts.find((c) => c.linkedUserId === '10');
  assert.equal(nam?.displayName, 'Nam');
  assert.equal(nam?.phoneNumber, '0901');
  assert.equal(contacts.find((c) => c.id === 'c-hung')?.phoneNumber, '0912');
  assert.equal(savedUsers.length, 0);

  const second = await service.syncUsersIntoContacts();
  assert.deepEqual(second, { created: 0, phoneFilled: 0, suggestions: [] });
});
