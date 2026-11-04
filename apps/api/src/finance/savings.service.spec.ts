import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException } from '@nestjs/common';
import type { SavingMovementType } from '@zalobot/contracts';
import { SavingGroupEntity } from '../database/entities/saving-group.entity';
import { SavingMovementEntity } from '../database/entities/saving-movement.entity';
import { computeLedger, type LedgerRow } from './finance.service';
import { savingMovementsInWindow } from './saving-ledger';
import { SavingsService } from './savings.service';

const at = (iso: string) => new Date(iso);

function income(id: string, amount: number, iso: string): LedgerRow {
  return { id, type: 'income', amount, occurredAt: at(iso), createdAt: at(iso) };
}

function movement(id: string, type: SavingMovementType, amount: number, iso = '2026-10-02') {
  return { id, groupId: 'g1', type, amount, occurredAt: at(iso), createdAt: at(iso) };
}

function createService(
  movements: ReturnType<typeof movement>[],
  group: Partial<SavingGroupEntity> = { id: 'g1', name: 'Du lịch' },
) {
  const saved: unknown[] = [];
  const removed: unknown[] = [];
  const manager = {
    findOne: () => Promise.resolve(group),
    find: () => Promise.resolve(movements),
    create: (_entity: unknown, value: object) => value,
    save: (entity: unknown, value: object) => {
      saved.push(value);
      if (entity === SavingGroupEntity) return Promise.resolve(value);
      return Promise.resolve({
        ...value,
        id: 'new',
        createdAt: at('2026-10-03'),
      } as SavingMovementEntity);
    },
    remove: (_entity: unknown, value: unknown) => {
      removed.push(value);
      return Promise.resolve(value);
    },
  };
  const service = new SavingsService(
    {
      manager: {
        transaction: (fn: (m: typeof manager) => unknown) => Promise.resolve(fn(manager)),
      },
    } as never,
    {} as never,
    { findOne: () => Promise.resolve({ firstName: 'Đạt' }) } as never,
    {} as never,
  );
  return { service, saved, removed };
}

void test('computeLedger: a deposit leaves the wallet and stays in the total', () => {
  const result = computeLedger(
    [income('in', 10_000_000, '2026-10-01')],
    [movement('dep', 'deposit', 2_000_000)],
  );
  assert.equal(result.ledgerBalance, 8_000_000);
  assert.equal(result.savingsTotal, 2_000_000);
  assert.equal(result.runningBalances.get('dep'), 8_000_000);
  assert.equal(result.runningBalancesWithSavings.get('dep'), 10_000_000);
});

void test('computeLedger: a withdrawal returns to the wallet', () => {
  const result = computeLedger(
    [income('in', 10_000_000, '2026-10-01')],
    [
      movement('dep', 'deposit', 2_000_000, '2026-10-02'),
      movement('out', 'withdrawal', 500_000, '2026-10-03'),
    ],
  );
  assert.equal(result.ledgerBalance, 8_500_000);
  assert.equal(result.savingsTotal, 1_500_000);
});

void test('computeLedger: an opening balance adds savings without touching the wallet', () => {
  const result = computeLedger(
    [income('in', 10_000_000, '2026-10-01')],
    [movement('open', 'opening', 3_000_000)],
  );
  assert.equal(result.ledgerBalance, 10_000_000);
  assert.equal(result.savingsTotal, 3_000_000);
  assert.equal(result.runningBalancesWithSavings.get('open'), 13_000_000);
});

void test('computeLedger: running balances follow the date of each entry', () => {
  const result = computeLedger(
    [income('in', 1_000_000, '2026-10-01'), income('later', 1_000_000, '2026-10-05')],
    [movement('dep', 'deposit', 400_000, '2026-10-03')],
  );
  assert.equal(result.runningBalances.get('in'), 1_000_000);
  assert.equal(result.runningBalances.get('later'), 1_600_000);
  assert.equal(result.runningBalancesWithSavings.get('later'), 2_000_000);
});

void test('savingMovementsInWindow puts a movement between two pages on exactly one page', () => {
  const rows = [{ occurredAt: at('2026-10-05') }];
  const newerPage = savingMovementsInWindow(rows, {
    from: at('2026-10-10'),
    toExclusive: false,
  });
  const olderPage = savingMovementsInWindow(rows, {
    from: at('2026-10-01'),
    to: at('2026-10-10'),
    toExclusive: true,
  });
  assert.equal(newerPage.length, 0);
  assert.equal(olderPage.length, 1);
});

void test('addMovement refuses to withdraw more than the group holds', async () => {
  const { service, saved } = createService([movement('dep', 'deposit', 1_000_000)]);
  await assert.rejects(
    service.addMovement('g1', { type: 'withdrawal', amount: 1_000_001 }, 'u1'),
    ConflictException,
  );
  assert.equal(saved.length, 0);
});

void test('addMovement withdraws up to the whole balance', async () => {
  const { service, saved } = createService([movement('dep', 'deposit', 1_000_000)]);
  const result = await service.addMovement('g1', { type: 'withdrawal', amount: 1_000_000 }, 'u1');
  assert.equal(result.groupName, 'Du lịch');
  assert.equal(result.createdByName, 'Đạt');
  assert.equal(saved.length, 1);
});

void test('addMovement allows a deposit larger than the wallet', async () => {
  const { service, saved } = createService([]);
  await service.addMovement('g1', { type: 'deposit', amount: 2_000_000_000 }, 'u1');
  assert.equal(saved.length, 1);
});

void test('addMovement rejects an archived group', async () => {
  const { service } = createService([], { id: 'g1', name: 'Cũ', archivedAt: at('2026-10-01') });
  await assert.rejects(
    service.addMovement('g1', { type: 'deposit', amount: 1 }, 'u1'),
    ConflictException,
  );
});

void test('removeMovement refuses a deposit that was already withdrawn', async () => {
  const { service, removed } = createService([
    movement('dep', 'deposit', 1_000_000),
    movement('out', 'withdrawal', 800_000),
  ]);
  await assert.rejects(service.removeMovement('g1', 'dep'), ConflictException);
  assert.equal(removed.length, 0);
});

void test('removeMovement removes a withdrawal', async () => {
  const { service, removed } = createService([
    movement('dep', 'deposit', 1_000_000),
    movement('out', 'withdrawal', 800_000),
  ]);
  await service.removeMovement('g1', 'out');
  assert.equal(removed.length, 1);
});

void test('archiveGroup refuses a group that still holds money', async () => {
  const { service } = createService([movement('dep', 'deposit', 1)]);
  await assert.rejects(service.archiveGroup('g1'), ConflictException);
});

void test('archiveGroup archives an empty group', async () => {
  const { service, saved } = createService([], {
    id: 'g1',
    name: 'Du lịch',
    createdAt: at('2026-10-01'),
  });
  const result = await service.archiveGroup('g1');
  assert.ok(result.archivedAt);
  assert.equal(saved.length, 1);
});
