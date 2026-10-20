import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { EntityTarget, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';
import { UserEntity } from '../database/entities/user.entity';
import type { CreateFinanceTransactionDto } from './finance.service';
import { FinanceController } from './finance.controller';
import { LedgerService, resolveLedgerUserIdOrSelf } from './ledger.service';
import { parseReceiptSource } from './receipt-source';
import { toTransactionItem } from './transaction-item.mapper';
import { RecordTransactionToolStrategy } from '../zalo/text/strategies/record-transaction-tool.strategy';
import type { AgentInput } from '../zalo/types/agent-input.type';

interface UpdateCall {
  target: string;
  criteria: Record<string, unknown>;
  partial: Record<string, unknown>;
}

function entityName(target: EntityTarget<ObjectLiteral>): string {
  return typeof target === 'function' ? target.name : typeof target === 'string' ? target : '';
}

/** LedgerService over an in-memory repository/manager pair. */
function createLedger(options: {
  ownerId: string | null;
  rowsByEntity?: Record<string, Array<{ userId: string }>>;
  users?: Array<{ id: string; firstName?: string }>;
}) {
  const updates: UpdateCall[] = [];
  const saved: Array<{ target: string; value: unknown }> = [];
  let ownerId = options.ownerId;
  const manager = {
    find: (target: EntityTarget<ObjectLiteral>) =>
      Promise.resolve(options.rowsByEntity?.[entityName(target)] ?? []),
    exists: () => Promise.resolve(true),
    update: (
      target: EntityTarget<ObjectLiteral>,
      criteria: FindOptionsWhere<ObjectLiteral>,
      partial: Record<string, unknown>,
    ) => {
      updates.push({ target: entityName(target), criteria, partial });
      if (entityName(target) === UserEntity.name && partial.isLedgerOwner === true) {
        ownerId = String(criteria.id);
      }
      return Promise.resolve({});
    },
    delete: () => Promise.resolve({}),
    save: (target: EntityTarget<ObjectLiteral>, value: unknown) => {
      saved.push({ target: entityName(target), value });
      return Promise.resolve(value);
    },
  };
  const userRepo = {
    findOne: () => Promise.resolve(ownerId ? { id: ownerId } : null),
    find: () => Promise.resolve(options.users ?? []),
    manager: {
      ...manager,
      transaction: <T>(work: (m: typeof manager) => Promise<T>) => work(manager),
    },
  };
  return { ledger: new LedgerService(userRepo as never), updates, saved };
}

void test('without a ledger owner every actor keeps their own ledger', async () => {
  const { ledger } = createLedger({ ownerId: null });
  assert.equal(await ledger.resolveLedgerUserId('5369'), '5369');
  assert.equal(await resolveLedgerUserIdOrSelf(undefined, 42), '42');
});

void test('with a ledger owner every actor reads and writes the owner ledger', async () => {
  const { ledger } = createLedger({ ownerId: null });
  await ledger.setOwner('2099');
  assert.equal(await ledger.resolveLedgerUserId('5369'), '2099');
  assert.equal(await ledger.resolveLedgerUserId('2099'), '2099');
  await ledger.setOwner(null);
  assert.equal(await ledger.resolveLedgerUserId('5369'), '5369');
});

void test('getInfo lists every other ledger, including orphaned user ids', async () => {
  const { ledger } = createLedger({
    ownerId: '2099',
    rowsByEntity: {
      FinanceTransactionEntity: [
        { userId: '2099' },
        { userId: '5369' },
        { userId: '2285' },
        { userId: '2285' },
      ],
      FinancePlaceEntity: [{ userId: '5369' }],
    },
    users: [
      { id: '2099', firstName: 'Văn Đạt' },
      { id: '5369', firstName: 'Diệu Hằng' },
    ],
  });

  const info = await ledger.getInfo();

  assert.equal(info.ownerUserId, '2099');
  assert.equal(info.ownerName, 'Văn Đạt');
  assert.deepEqual(
    info.sources.map((s) => [s.userId, s.hasAccount, s.counts.transactions, s.counts.places]),
    [
      ['2285', false, 2, 0],
      ['5369', true, 1, 1],
    ],
  );
});

void test('consolidate keeps authorship, moves other ledgers into the owner and audits it', async () => {
  const { ledger, updates, saved } = createLedger({
    ownerId: '2099',
    rowsByEntity: {
      FinanceTransactionEntity: [{ userId: '2099' }, { userId: '5369' }],
    },
  });

  const result = await ledger.consolidate('2099');

  assert.deepEqual(result.mergedUserIds, ['5369']);
  assert.equal(result.counts.transactions, 1);
  const txUpdates = updates.filter((u) => u.target === FinanceTransactionEntity.name);
  // Authorship backfill happens before rows move to the owner.
  const backfill = txUpdates.findIndex(
    (u) => u.criteria.userId === '5369' && u.partial.createdByUserId === '5369',
  );
  const move = txUpdates.findIndex(
    (u) => u.criteria.userId === '5369' && u.partial.userId === '2099',
  );
  assert.ok(backfill >= 0 && move > backfill);
  assert.equal(saved.length, 1);
});

void test('consolidate requires a ledger owner', async () => {
  const { ledger } = createLedger({ ownerId: null });
  await assert.rejects(ledger.consolidate('2099'), BadRequestException);
});

void test('parseReceiptSource accepts Drive files and Zalo CDN only', () => {
  assert.deepEqual(parseReceiptSource('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view'), {
    kind: 'drive',
    fileId: '1AbCdEfGhIjKlMn',
  });
  assert.deepEqual(parseReceiptSource('https://f21-zpc.zdn.vn/jpg/123/abc.jpg'), {
    kind: 'zalo',
    url: 'https://f21-zpc.zdn.vn/jpg/123/abc.jpg',
  });
  assert.equal(parseReceiptSource('http://169.254.169.254/latest/meta-data'), null);
  assert.equal(parseReceiptSource('https://evil.example.com/a.jpg'), null);
  assert.equal(parseReceiptSource('https://f21-zpc.zdn.vn.evil.com/a.jpg'), null);
  assert.equal(parseReceiptSource('/api/receipts/1'), null);
  assert.equal(parseReceiptSource(undefined), null);
});

void test('toTransactionItem exposes creator, source chat and hasReceipt but not the raw URL', () => {
  const entity = {
    id: 'tx-1',
    userId: '2099',
    type: 'expense',
    amount: 298_620,
    currency: 'VND',
    category: 'Mua sắm',
    note: 'Đồ chơi',
    occurredAt: new Date('2026-10-20T03:25:00.000Z'),
    createdAt: new Date('2026-10-20T03:28:55.000Z'),
    updatedAt: new Date('2026-10-20T03:28:55.000Z'),
    createdByUserId: '5369',
    createdByName: 'Hằng (Zalo)',
    source: 'zalo',
    sourceChatId: 'g-1',
    receiptUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view',
  } as FinanceTransactionEntity;

  const item = toTransactionItem(entity, {
    userNames: new Map([['5369', 'Diệu Hằng']]),
    chats: new Map([['g-1', { name: 'Gia đình', type: 'group' as const }]]),
  });

  assert.equal(item.createdByName, 'Diệu Hằng');
  assert.equal(item.sourceChatName, 'Gia đình');
  assert.equal(item.sourceChatType, 'group');
  assert.equal(item.hasReceipt, true);
  assert.equal('receiptUrl' in item, false);
  // Falls back to the snapshot when the creator has no users row.
  assert.equal(toTransactionItem(entity).createdByName, 'Hằng (Zalo)');
});

void test('GET /api/transactions/:id/receipt only serves receipts from the caller ledger', async () => {
  const lookedUp: unknown[] = [];
  const controller = new FinanceController(
    {
      getTransaction: (userId: string, id: string) => {
        lookedUp.push([userId, id]);
        return Promise.resolve(null);
      },
    } as never,
    { verifyAccessToken: () => '5369' } as never,
    {} as never,
    {} as never,
    { resolveLedgerUserId: () => Promise.resolve('2099') } as never,
  );
  const req = { headers: { authorization: 'Bearer token' } } as Request;

  await assert.rejects(
    controller.getTransactionReceipt(req, {} as Response, 'tx-other'),
    NotFoundException,
  );
  assert.deepEqual(lookedUp, [['2099', 'tx-other']]);
});

void test('Zalo RECORD_TRANSACTION records into the ledger owner and remembers the sender', async () => {
  const pending: Array<{ userId: string; payload: CreateFinanceTransactionDto }> = [];
  const strategy = new RecordTransactionToolStrategy(
    { sendMessage: () => Promise.resolve(true) } as never,
    {
      createPending: (params: { userId: string; payload: CreateFinanceTransactionDto }) => {
        pending.push(params);
        return Promise.resolve({ code: '837' });
      },
    } as never,
    undefined,
    { resolveLedgerUserId: () => Promise.resolve('2099') } as never,
  );

  await strategy.execute({
    input: { type: 'text', text: 'mua đồ chơi 298620' } as AgentInput,
    chatId: 'g-1',
    senderId: '5369',
    displayName: 'Diệu Hằng',
    text: 'mua đồ chơi 298620',
    toolArgs: { type: 'expense', amount: 298620, category: 'Mua sắm', note: 'Đồ chơi' },
  });

  assert.equal(pending.length, 1);
  // The sender still owns the confirmation card; the data lands in the shared ledger.
  assert.equal(pending[0].userId, '5369');
  assert.equal(pending[0].payload.userId, '2099');
  assert.equal(pending[0].payload.createdByUserId, '5369');
  assert.equal(pending[0].payload.createdByName, 'Diệu Hằng');
  assert.equal(pending[0].payload.source, 'zalo');
  assert.equal(pending[0].payload.sourceChatId, 'g-1');
});
