import assert from 'node:assert/strict';
import test from 'node:test';
import { DebtEntity } from '../database/entities/debt.entity';
import { DebtPaymentEntity } from '../database/entities/debt-payment.entity';
import { DebtPaymentAllocationEntity } from '../database/entities/debt-payment-allocation.entity';
import { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';
import { FinancePlaceEntity } from '../database/entities/finance-place.entity';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { FinanceService } from './finance.service';

function createFinanceService(debt: Partial<DebtEntity>) {
  const savedTransactions: Partial<FinanceTransactionEntity>[] = [];
  const savedPayments: Partial<DebtPaymentEntity>[] = [];
  const debtRepository = {
    findOne: () => Promise.resolve(debt),
    save: (value: Partial<DebtEntity>) => Promise.resolve(value),
  };
  const debtPaymentRepository = {
    create: (value: Partial<DebtPaymentEntity>) => ({ id: 'payment-1', ...value }),
    save: (value: Partial<DebtPaymentEntity>) => {
      savedPayments.push(value);
      return Promise.resolve(value);
    },
  };
  const transactionRepository = {
    create: (value: Partial<FinanceTransactionEntity>) => value,
    save: (value: Partial<FinanceTransactionEntity>) => {
      savedTransactions.push(value);
      return Promise.resolve(value);
    },
  };
  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === DebtEntity) return debtRepository;
      if (entity === DebtPaymentEntity) return debtPaymentRepository;
      return transactionRepository;
    },
  };
  const service = new FinanceService(
    {
      manager: {
        transaction: (callback: (value: typeof manager) => unknown) =>
          Promise.resolve(callback(manager)),
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return { service, savedPayments, savedTransactions };
}

void test('recordDebtPayment records an income when recovering a receivable', async () => {
  const debt = {
    id: 'debt-1',
    userId: '42',
    direction: 'receivable' as const,
    counterparty: 'Nam',
    contactId: 'contact-1',
    remainingAmount: 500_000,
    currency: 'VND',
    status: 'active' as const,
  };
  const { service, savedPayments, savedTransactions } = createFinanceService(debt);

  await service.recordDebtPayment(42, debt.id, 200_000, '2026-08-24T10:00:00.000Z', 'Chuyển khoản');

  assert.equal(debt.remainingAmount, 300_000);
  assert.equal(savedPayments.length, 1);
  assert.deepEqual(savedTransactions, [
    {
      userId: '42',
      type: 'income',
      amount: 200_000,
      currency: 'VND',
      category: 'Thu hồi nợ',
      contactId: 'contact-1',
      note: 'Thu hồi nợ từ Nam: Chuyển khoản',
      occurredAt: new Date('2026-08-24T10:00:00.000Z'),
    },
  ]);
});

void test('recordDebtPayment records an expense when paying a payable debt', async () => {
  const debt = {
    id: 'debt-2',
    userId: '42',
    direction: 'payable' as const,
    counterparty: 'Lan',
    remainingAmount: 200_000,
    currency: 'VND',
    status: 'active' as const,
  };
  const { service, savedTransactions } = createFinanceService(debt);

  await service.recordDebtPayment(42, debt.id, 200_000);

  assert.equal(debt.remainingAmount, 0);
  assert.equal(debt.status, 'settled');
  assert.deepEqual(savedTransactions[0], {
    userId: '42',
    type: 'expense',
    amount: 200_000,
    currency: 'VND',
    category: 'Trả nợ',
    contactId: undefined,
    note: 'Trả nợ cho Lan',
    occurredAt: savedTransactions[0]?.occurredAt,
  });
});

void test('createTransaction reuses a user-scoped place instead of creating a debt contact', async () => {
  let storedPlace: FinancePlaceEntity | undefined;
  const savedTransactions: Partial<FinanceTransactionEntity>[] = [];
  const service = new FinanceService(
    {
      create: (value: Partial<FinanceTransactionEntity>) => value,
      save: (value: Partial<FinanceTransactionEntity>) => {
        savedTransactions.push(value);
        return Promise.resolve(value);
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      findOne: () => Promise.resolve(storedPlace),
      create: (value: Partial<FinancePlaceEntity>) => value,
      save: (value: Partial<FinancePlaceEntity>) => {
        storedPlace = {
          id: 'place-1',
          userId: '42',
          name: value.name || 'Highlands Coffee',
          normalizedName: value.normalizedName || 'highlands coffee',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return Promise.resolve(storedPlace);
      },
    } as never,
  );

  await service.createTransaction({
    userId: 42,
    type: 'expense',
    amount: 45_000,
    note: 'Cà phê sáng',
    placeName: 'Highlands Coffee',
  });
  await service.createTransaction({
    userId: 42,
    type: 'expense',
    amount: 30_000,
    note: 'Trà đào',
    placeName: 'highlands coffee',
  });

  assert.deepEqual(
    savedTransactions.map((transaction) => transaction.placeId),
    ['place-1', 'place-1'],
  );
  assert.equal(savedTransactions[0]?.contactId, undefined);
});

void test('FinanceService.resolvePlaces finds places matching normalized name', async () => {
  const mockPlaces: FinancePlaceEntity[] = [
    {
      id: 'place-tch',
      userId: '42',
      name: 'The Coffee House Tô Hiệu',
      normalizedName: 'the coffee house to hieu',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const service = new FinanceService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      find: (opts: { where: { userId: string; normalizedName: string } }) => {
        assert.equal(opts.where.userId, '42');
        assert.equal(opts.where.normalizedName, 'the coffee house to hieu');
        return Promise.resolve(mockPlaces);
      },
    } as never,
  );

  const found = await service.resolvePlaces(42, 'The Coffee House Tô Hiệu');
  assert.equal(found.length, 1);
  assert.equal(found[0]?.id, 'place-tch');
  assert.equal(found[0]?.name, 'The Coffee House Tô Hiệu');

  const empty = await service.resolvePlaces(42, '   ');
  assert.equal(empty.length, 0);
});

void test('FinanceService.getAnalyticsReport computes cumulative balance and opening balance', async () => {
  const transactions: FinanceTransactionEntity[] = [
    {
      id: 'tx-1',
      userId: '42',
      type: 'income',
      amount: 10_000_000,
      currency: 'VND',
      category: 'Lương',
      note: 'Lương tháng 7',
      occurredAt: new Date('2026-07-25T10:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'tx-2',
      userId: '42',
      type: 'expense',
      amount: 2_000_000,
      currency: 'VND',
      category: 'Mua sắm',
      note: 'Tiền nhà tháng 7',
      occurredAt: new Date('2026-07-28T10:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'tx-3',
      userId: '42',
      type: 'income',
      amount: 5_000_000,
      currency: 'VND',
      category: 'Thưởng',
      note: 'Thưởng tháng 8',
      occurredAt: new Date('2026-08-02T10:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'tx-4',
      userId: '42',
      type: 'expense',
      amount: 1_000_000,
      currency: 'VND',
      category: 'Ăn uống',
      note: 'Ăn uống',
      occurredAt: new Date('2026-08-08T10:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const transactionRepository = {
    find: (opts?: {
      where?: {
        userId?: string;
        occurredAt?: { _type?: string; _value?: unknown; value?: unknown };
      };
    }) => {
      let list = [...transactions];
      const occurred = opts?.where?.occurredAt;
      if (occurred && typeof occurred === 'object') {
        const type = occurred._type;
        const val = occurred._value ?? occurred.value;
        if (type === 'between' && Array.isArray(val)) {
          const [start, end] = val as [Date, Date];
          list = list.filter((t) => t.occurredAt >= start && t.occurredAt <= end);
        } else if (type === 'lessThan' && val instanceof Date) {
          list = list.filter((t) => t.occurredAt < val);
        } else if (type === 'moreThanOrEqual' && val instanceof Date) {
          list = list.filter((t) => t.occurredAt >= val);
        } else if (type === 'lessThanOrEqual' && val instanceof Date) {
          list = list.filter((t) => t.occurredAt <= val);
        }
      }
      return Promise.resolve(list);
    },
  };

  const debtRepository = {
    find: () =>
      Promise.resolve([
        { direction: 'receivable', remainingAmount: 500_000, counterparty: 'Trí' },
        { direction: 'payable', remainingAmount: 13_000_000, counterparty: 'Hằng' },
      ]),
    createQueryBuilder: () => {
      const debtQuery = {
        leftJoinAndSelect: () => debtQuery,
        where: () => debtQuery,
        andWhere: () => debtQuery,
        orderBy: () => debtQuery,
        addOrderBy: () => debtQuery,
        getMany: () =>
          Promise.resolve([
            { direction: 'receivable', remainingAmount: 500_000, counterparty: 'Trí' },
            { direction: 'payable', remainingAmount: 13_000_000, counterparty: 'Hằng' },
          ]),
      };
      return debtQuery;
    },
  };

  const service = new FinanceService(
    transactionRepository as never,
    debtRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const report = await service.getAnalyticsReport(
    42,
    '2026-08-01T00:00:00.000Z',
    '2026-08-31T23:59:59.999Z',
    'month',
  );

  // Opening balance before Aug 1 = 10tr - 2tr = 8tr
  // Bucket p1 (1-5): income = 5tr, expense = 0 -> netCashflow = +5tr -> balance = 8tr + 5tr = 13tr
  // Bucket p2 (6-10): income = 0, expense = 1tr -> netCashflow = -1tr -> balance = 13tr - 1tr = 12tr
  assert.equal(report.trend[0]?.label, '1-5');
  assert.equal(report.trend[0]?.income, 5_000_000);
  assert.equal(report.trend[0]?.expense, 0);
  assert.equal(report.trend[0]?.netCashflow, 5_000_000);
  assert.equal(report.trend[0]?.balance, 13_000_000);

  assert.equal(report.trend[1]?.label, '6-10');
  assert.equal(report.trend[1]?.income, 0);
  assert.equal(report.trend[1]?.expense, 1_000_000);
  assert.equal(report.trend[1]?.netCashflow, -1_000_000);
  assert.equal(report.trend[1]?.balance, 12_000_000);
  assert.deepEqual(report.summary, {
    income: 5_000_000,
    expense: 1_000_000,
    balance: 4_000_000,
    netSavingsRate: 80,
    receivableTotal: 500_000,
    payableTotal: 13_000_000,
  });
  assert.deepEqual(report.currentPosition, {
    cashflowBalance: 12_000_000,
    receivable: 500_000,
    payable: 13_000_000,
    netWorth: -500_000,
  });
});

void test('FinanceService.getAnalyticsReport separates income and expense with identical categories', async () => {
  const transactions: FinanceTransactionEntity[] = [
    {
      id: 'tx-1',
      userId: '42',
      type: 'income',
      amount: 10_000_000,
      currency: 'VND',
      category: 'Khác',
      note: 'Thu nhập khác',
      occurredAt: new Date('2026-08-01T10:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'tx-2',
      userId: '42',
      type: 'expense',
      amount: 550_000,
      currency: 'VND',
      category: 'Khác',
      note: 'Chi tiêu khác',
      occurredAt: new Date('2026-08-05T10:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'tx-3',
      userId: '42',
      type: 'expense',
      amount: 227_000,
      currency: 'VND',
      category: 'Ăn uống',
      note: 'Cơm trưa',
      occurredAt: new Date('2026-08-10T10:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const transactionRepository = {
    find: () => Promise.resolve(transactions),
  };
  const debtQuery = {
    leftJoinAndSelect: () => debtQuery,
    where: () => debtQuery,
    getMany: () => Promise.resolve([]),
  };
  const debtRepository = {
    find: () => Promise.resolve([]),
    createQueryBuilder: () => debtQuery,
  };

  const service = new FinanceService(
    transactionRepository as never,
    debtRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const report = await service.getAnalyticsReport(
    42,
    '2026-08-01T00:00:00.000Z',
    '2026-08-31T23:59:59.999Z',
    'month',
  );

  assert.equal(report.summary.expense, 777_000);
  assert.equal(report.summary.income, 10_000_000);

  const expenseCategories = report.categories.filter((c) => c.type === 'expense');
  const incomeCategories = report.categories.filter((c) => c.type === 'income');

  assert.equal(expenseCategories.length, 2);
  assert.equal(incomeCategories.length, 1);

  const expenseKhac = expenseCategories.find((c) => c.category === 'Khác');
  const expenseAnUong = expenseCategories.find((c) => c.category === 'Ăn uống');
  const incomeKhac = incomeCategories.find((c) => c.category === 'Khác');

  assert.equal(expenseKhac?.amount, 550_000);
  assert.equal(expenseKhac?.percentage, 70.8);
  assert.equal(expenseAnUong?.amount, 227_000);
  assert.equal(expenseAnUong?.percentage, 29.2);
  assert.equal(incomeKhac?.amount, 10_000_000);
  assert.equal(incomeKhac?.percentage, 100);
});

void test('allocateTransactionToDebts allocates funds to multiple debts atomically', async () => {
  const mockTransaction: Partial<FinanceTransactionEntity> = {
    id: 'tx-1',
    userId: '42',
    type: 'income',
    amount: 5_000_000,
    currency: 'VND',
    occurredAt: new Date('2026-08-20T10:00:00Z'),
  };

  const debt1: Partial<DebtEntity> = {
    id: 'debt-1',
    userId: '42',
    direction: 'receivable',
    counterparty: 'Trí',
    originalAmount: 3_000_000,
    remainingAmount: 3_000_000,
    status: 'active',
    currency: 'VND',
  };

  const debt2: Partial<DebtEntity> = {
    id: 'debt-2',
    userId: '42',
    direction: 'receivable',
    counterparty: 'Trí',
    originalAmount: 4_000_000,
    remainingAmount: 4_000_000,
    status: 'active',
    currency: 'VND',
  };

  const savedAllocs: Partial<DebtPaymentAllocationEntity>[] = [];
  const savedPayments: Partial<DebtPaymentEntity>[] = [];
  const existingAllocs: Partial<DebtPaymentAllocationEntity>[] = [];

  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === FinanceTransactionEntity) {
        return {
          findOne: () => Promise.resolve(mockTransaction),
        };
      }
      if (entity === DebtEntity) {
        return {
          find: () => Promise.resolve([debt1, debt2]),
          save: (d: Partial<DebtEntity>) => Promise.resolve(d),
        };
      }
      if (entity === DebtPaymentAllocationEntity) {
        return {
          find: () => Promise.resolve(existingAllocs),
          delete: () => Promise.resolve(),
          create: (v: Partial<DebtPaymentAllocationEntity>) => ({ id: 'alloc-1', ...v }),
          save: (v: Partial<DebtPaymentAllocationEntity>) => {
            savedAllocs.push(v);
            return Promise.resolve(v);
          },
        };
      }
      if (entity === DebtPaymentEntity) {
        return {
          delete: () => Promise.resolve(),
          create: (v: Partial<DebtPaymentEntity>) => ({ id: 'payment-1', ...v }),
          save: (v: Partial<DebtPaymentEntity>) => {
            savedPayments.push(v);
            return Promise.resolve(v);
          },
        };
      }
      return {};
    },
  };

  const service = new FinanceService(
    {
      manager: {
        transaction: (cb: (m: typeof manager) => unknown) => Promise.resolve(cb(manager)),
      },
      findOne: () => Promise.resolve(mockTransaction),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const result = await service.allocateTransactionToDebts(42, 'tx-1', [
    { debtId: 'debt-1', amount: 3_000_000 },
    { debtId: 'debt-2', amount: 2_000_000 },
  ]);

  assert.equal(result.allocations.length, 2);
  assert.equal(result.remainingUnallocated, 0);
  assert.equal(debt1.remainingAmount, 0);
  assert.equal(debt1.status, 'settled');
  assert.equal(debt2.remainingAmount, 2_000_000);
  assert.equal(debt2.status, 'active');
  assert.equal(savedAllocs.length, 2);
  assert.equal(savedPayments.length, 2);
});

void test('allocateTransactionToDebts rejects when allocated sum exceeds transaction amount', async () => {
  const mockTransaction: Partial<FinanceTransactionEntity> = {
    id: 'tx-2',
    userId: '42',
    type: 'income',
    amount: 1_000_000,
  };

  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === FinanceTransactionEntity) {
        return { findOne: () => Promise.resolve(mockTransaction) };
      }
      return {};
    },
  };

  const service = new FinanceService(
    {
      manager: {
        transaction: (cb: (m: typeof manager) => unknown) => Promise.resolve(cb(manager)),
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    () => service.allocateTransactionToDebts(42, 'tx-2', [{ debtId: 'debt-1', amount: 2_000_000 }]),
    /vượt quá số tiền giao dịch/,
  );
});

void test('FinanceService.combineDebts combines debts into a parent debt hierarchy', async () => {
  const child1: Partial<DebtEntity> = {
    id: 'debt-a',
    userId: '42',
    direction: 'receivable',
    counterparty: 'Nguyễn Văn A',
    originalAmount: 500_000,
    remainingAmount: 500_000,
    currency: 'VND',
    status: 'active',
  };
  const child2: Partial<DebtEntity> = {
    id: 'debt-b',
    userId: '42',
    direction: 'receivable',
    counterparty: 'Nguyễn Văn A',
    originalAmount: 300_000,
    remainingAmount: 300_000,
    currency: 'VND',
    status: 'active',
  };

  const savedChildren: DebtEntity[] = [];
  let savedParent: Partial<DebtEntity> | null = null;

  const debtRepo = {
    find: () => Promise.resolve([child1 as DebtEntity, child2 as DebtEntity]),
    manager: {
      transaction: async (cb: (manager: unknown) => Promise<unknown>) => {
        const mockManager = {
          create: (_entity: unknown, data: Partial<DebtEntity>) => ({
            id: 'parent-c',
            ...data,
          }),
          save: (_entity: unknown, target: Partial<DebtEntity>) => {
            if (target.id === 'parent-c') {
              savedParent = target;
              return Promise.resolve(target);
            }
            savedChildren.push(target as DebtEntity);
            return Promise.resolve(target);
          },
          findOne: (_entity: unknown, opts: { where: { id: string } }) => {
            return Promise.resolve({
              ...savedParent,
              id: opts.where.id,
              children: [child1, child2],
            });
          },
        };
        return cb(mockManager);
      },
    },
  };

  const service = new FinanceService(
    {} as never,
    debtRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const result = await service.combineDebts(42, {
    debtIds: ['debt-a', 'debt-b'],
    note: 'Gộp nợ anh A',
  });

  assert.equal(result.mergedDebtsCount, 2);
  assert.equal(result.parentDebt.id, 'parent-c');
  assert.equal(result.parentDebt.originalAmount, 800_000);
  assert.equal(result.parentDebt.remainingAmount, 800_000);
  assert.equal(result.parentDebt.direction, 'receivable');
  assert.equal(child1.parentDebtId, 'parent-c');
  assert.equal(child2.parentDebtId, 'parent-c');
});

void test('FinanceService.combineDebts rejects debts with mismatched directions', async () => {
  const debt1: Partial<DebtEntity> = {
    id: 'debt-1',
    userId: '42',
    direction: 'receivable',
    originalAmount: 500_000,
    remainingAmount: 500_000,
  };
  const debt2: Partial<DebtEntity> = {
    id: 'debt-2',
    userId: '42',
    direction: 'payable',
    originalAmount: 300_000,
    remainingAmount: 300_000,
  };

  const debtRepo = {
    find: () => Promise.resolve([debt1 as DebtEntity, debt2 as DebtEntity]),
  };

  const service = new FinanceService(
    {} as never,
    debtRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    () => service.combineDebts(42, { debtIds: ['debt-1', 'debt-2'] }),
    /Chỉ có thể gộp các khoản nợ cùng chiều/,
  );
});

void test('FinanceService.combineDebts rejects when fewer than 2 debts provided', async () => {
  const service = new FinanceService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    () => service.combineDebts(42, { debtIds: ['debt-1'] }),
    /Cần chọn ít nhất 2 khoản nợ để gộp/,
  );
});

void test('FinanceService.combineDebts rejects debts with mismatched currencies', async () => {
  const debt1: Partial<DebtEntity> = {
    id: 'debt-1',
    userId: '42',
    direction: 'receivable',
    currency: 'VND',
    originalAmount: 500_000,
    remainingAmount: 500_000,
  };
  const debt2: Partial<DebtEntity> = {
    id: 'debt-2',
    userId: '42',
    direction: 'receivable',
    currency: 'USD',
    originalAmount: 100,
    remainingAmount: 100,
  };

  const debtRepo = {
    find: () => Promise.resolve([debt1 as DebtEntity, debt2 as DebtEntity]),
  };

  const service = new FinanceService(
    {} as never,
    debtRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    () => service.combineDebts(42, { debtIds: ['debt-1', 'debt-2'] }),
    /Chỉ có thể gộp các khoản nợ có cùng đơn vị tiền tệ/,
  );
});

void test('FinanceService.getSummary calculates income, expense, balance with find filter', async () => {
  const transactions: FinanceTransactionEntity[] = [
    {
      id: 'tx-1',
      userId: '42',
      type: 'income',
      amount: 15_000_000,
      currency: 'VND',
      category: 'Lương',
      note: 'Lương',
      occurredAt: new Date('2026-08-15T10:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'tx-2',
      userId: '42',
      type: 'expense',
      amount: 5_000_000,
      currency: 'VND',
      category: 'Chi phí',
      note: 'Tiền trọ',
      occurredAt: new Date('2026-08-16T10:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const transactionRepository = {
    find: () => Promise.resolve(transactions),
  };

  const service = new FinanceService(
    transactionRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const summary = await service.getSummary(
    42,
    '2026-08-01T00:00:00.000Z',
    '2026-08-31T23:59:59.999Z',
  );
  assert.equal(summary.income, 15_000_000);
  assert.equal(summary.expense, 5_000_000);
  assert.equal(summary.balance, 10_000_000);
  assert.equal(summary.transactions.length, 2);
});

void test('FinanceService.listTransactions queries transactions with relations and order', async () => {
  const mockTransactions: FinanceTransactionEntity[] = [
    {
      id: 'tx-1',
      userId: '42',
      type: 'expense',
      amount: 50_000,
      currency: 'VND',
      category: 'Ăn uống',
      note: 'Cơm trưa',
      occurredAt: new Date('2026-08-20T12:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  let findCalledWith: unknown;
  const transactionRepository = {
    find: (opts: unknown) => {
      findCalledWith = opts;
      return Promise.resolve(mockTransactions);
    },
  };

  const service = new FinanceService(
    transactionRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const list = await service.listTransactions(42, 'expense');
  assert.equal(list.length, 1);
  assert.equal(list[0]?.amount, 50_000);
  assert.deepEqual((findCalledWith as { where: { userId: string; type: string } }).where, {
    userId: '42',
    type: 'expense',
  });
});

void test('FinanceService.updateTransaction blocks changing type when allocations exist', async () => {
  const mockTx: Partial<FinanceTransactionEntity> = {
    id: 'tx-alloc-1',
    userId: '42',
    type: 'income',
    amount: 1_000_000,
    category: 'Thu hồi nợ',
    note: 'Được trả nợ',
    allocations: [
      {
        id: 'alloc-1',
        userId: '42',
        financeTransactionId: 'tx-alloc-1',
        debtId: 'debt-1',
        amount: 600_000,
        createdAt: new Date(),
        updatedAt: new Date(),
        allocatedAt: new Date(),
      } as DebtPaymentAllocationEntity,
    ],
  };

  const transactionRepository = {
    findOne: () => Promise.resolve(mockTx as FinanceTransactionEntity),
    save: (entity: unknown) => Promise.resolve(entity),
  };

  const service = new FinanceService(
    transactionRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    async () => {
      await service.updateTransaction(42, 'tx-alloc-1', { type: 'expense' });
    },
    {
      name: 'Error',
      message: 'Không thể đổi loại giao dịch khi đang có phân bổ công nợ.',
    },
  );
});

void test('FinanceService.updateTransaction blocks reducing amount below total allocated amount', async () => {
  const mockTx: Partial<FinanceTransactionEntity> = {
    id: 'tx-alloc-2',
    userId: '42',
    type: 'expense',
    amount: 1_000_000,
    category: 'Trả nợ',
    note: 'Trả nợ',
    allocations: [
      {
        id: 'alloc-1',
        userId: '42',
        financeTransactionId: 'tx-alloc-2',
        debtId: 'debt-1',
        amount: 400_000,
        createdAt: new Date(),
        updatedAt: new Date(),
        allocatedAt: new Date(),
      } as DebtPaymentAllocationEntity,
      {
        id: 'alloc-2',
        userId: '42',
        financeTransactionId: 'tx-alloc-2',
        debtId: 'debt-2',
        amount: 300_000,
        createdAt: new Date(),
        updatedAt: new Date(),
        allocatedAt: new Date(),
      } as DebtPaymentAllocationEntity,
    ],
  };

  const transactionRepository = {
    findOne: () => Promise.resolve(mockTx as FinanceTransactionEntity),
    save: (entity: unknown) => Promise.resolve(entity),
  };

  const service = new FinanceService(
    transactionRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  // Total allocated is 700_000. Reducing amount to 500_000 should fail.
  await assert.rejects(
    async () => {
      await service.updateTransaction(42, 'tx-alloc-2', { amount: 500_000 });
    },
    {
      name: 'Error',
      message:
        'Số tiền giao dịch mới không được nhỏ hơn tổng số tiền đã phân bổ công nợ (700.000đ).',
    },
  );

  // Updating amount to 800_000 (>= 700_000) should succeed.
  const updated = await service.updateTransaction(42, 'tx-alloc-2', { amount: 800_000 });
  assert.equal(updated?.amount, 800_000);
});

void test('FinanceService.deleteTransaction restores debt remaining amount when deleting transaction with allocations', async () => {
  const mockTx: Partial<FinanceTransactionEntity> = {
    id: 'tx-del-1',
    userId: '42',
    type: 'expense',
    amount: 1_000_000,
    category: 'Trả nợ',
    note: 'Giao dịch trả nợ',
  };

  const mockAllocations: Partial<DebtPaymentAllocationEntity>[] = [
    {
      id: 'alloc-1',
      userId: '42',
      financeTransactionId: 'tx-del-1',
      debtId: 'debt-1',
      amount: 400_000,
    },
    {
      id: 'alloc-2',
      userId: '42',
      financeTransactionId: 'tx-del-1',
      debtId: 'debt-2',
      amount: 300_000,
    },
  ];

  const mockDebts: Partial<DebtEntity>[] = [
    { id: 'debt-1', userId: '42', remainingAmount: 600_000 },
    { id: 'debt-2', userId: '42', remainingAmount: 200_000 },
  ];

  let removedTx: unknown = null;
  let savedDebts: unknown = null;
  let deletedAllocCriteria: unknown = null;
  let deletedPaymentCriteria: unknown = null;

  const transactionRepository = {
    findOne: () => Promise.resolve(mockTx as FinanceTransactionEntity),
    remove: (entity: unknown) => {
      removedTx = entity;
      return Promise.resolve(entity);
    },
  };

  const debtRepository = {
    find: () => Promise.resolve(mockDebts as DebtEntity[]),
    save: (entities: unknown) => {
      savedDebts = entities;
      return Promise.resolve(entities);
    },
  };

  const allocationRepository = {
    find: () => Promise.resolve(mockAllocations as DebtPaymentAllocationEntity[]),
    delete: (criteria: unknown) => {
      deletedAllocCriteria = criteria;
      return Promise.resolve({ affected: 2 });
    },
  };

  const debtPaymentRepository = {
    delete: (criteria: unknown) => {
      deletedPaymentCriteria = criteria;
      return Promise.resolve({ affected: 2 });
    },
  };

  const service = new FinanceService(
    transactionRepository as never,
    debtRepository as never,
    {} as never,
    debtPaymentRepository as never,
    allocationRepository as never,
    {} as never,
    {} as never,
  );

  const result = await service.deleteTransaction(42, 'tx-del-1');
  assert.equal(result, true);
  assert.deepEqual(removedTx, mockTx);

  // Remaining amounts should be restored: 600k + 400k = 1M, 200k + 300k = 500k
  const debt1 = (savedDebts as DebtEntity[])?.find((d) => d.id === 'debt-1');
  const debt2 = (savedDebts as DebtEntity[])?.find((d) => d.id === 'debt-2');
  assert.equal(debt1?.remainingAmount, 1_000_000);
  assert.equal(debt2?.remainingAmount, 500_000);

  assert.deepEqual(deletedAllocCriteria, { financeTransactionId: 'tx-del-1', userId: '42' });
  assert.deepEqual(deletedPaymentCriteria, { financeTransactionId: 'tx-del-1', userId: '42' });
});

void test('FinanceService.combinePlaces selects highest transaction count as lead, reassigns transactions, and updates name', async () => {
  const placeA: FinancePlaceEntity = {
    id: 'place-a',
    userId: '42',
    name: 'Highlands',
    normalizedName: 'highlands',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
  const placeB: FinancePlaceEntity = {
    id: 'place-b',
    userId: '42',
    name: 'Highlands Coffee',
    normalizedName: 'highlands coffee',
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
  };

  const transactionsOfA: Partial<FinanceTransactionEntity>[] = [
    { id: 'tx-1', userId: '42', placeId: 'place-a' },
  ];

  let removedPlaces: FinancePlaceEntity[] = [];
  let savedPlace: FinancePlaceEntity | undefined;
  let savedTransactions: Partial<FinanceTransactionEntity>[] = [];

  const service = new FinanceService(
    {
      count: (opts: { where: { placeId: string; userId: string } }) => {
        if (opts.where.placeId === 'place-a') return Promise.resolve(1);
        if (opts.where.placeId === 'place-b') return Promise.resolve(5);
        return Promise.resolve(0);
      },
      find: () => Promise.resolve(transactionsOfA),
      save: (txs: Partial<FinanceTransactionEntity>[]) => {
        savedTransactions = txs;
        return Promise.resolve(txs);
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      find: () => Promise.resolve([placeA, placeB]),
      findOne: () => Promise.resolve(null),
      remove: (places: FinancePlaceEntity[]) => {
        removedPlaces = places;
        return Promise.resolve(places);
      },
      save: (p: FinancePlaceEntity) => {
        savedPlace = p;
        return Promise.resolve(p);
      },
    } as never,
  );

  const result = await service.combinePlaces(42, {
    placeIds: ['place-a', 'place-b'],
    name: 'Highlands Coffee Landmark',
  });

  // placeB had 5 transactions, placeA had 1 -> placeB is lead
  assert.equal(result.leadPlace.id, 'place-b');
  assert.equal(result.leadPlace.name, 'Highlands Coffee Landmark');
  assert.equal(result.mergedPlacesCount, 1);
  assert.equal(result.affectedTransactionsCount, 1);
  assert.equal(result.leadPlace.transactionCount, 6);

  // transactions of placeA were reassigned to placeB
  assert.equal(savedTransactions.length, 1);
  assert.equal(savedTransactions[0].placeId, 'place-b');

  // placeA was removed
  assert.equal(removedPlaces.length, 1);
  assert.equal(removedPlaces[0].id, 'place-a');

  // lead place was updated
  assert.equal(savedPlace?.id, 'place-b');
  assert.equal(savedPlace?.name, 'Highlands Coffee Landmark');
});

void test('FinanceService.combinePlaces respects explicit targetPlaceId', async () => {
  const placeA: FinancePlaceEntity = {
    id: 'place-a',
    userId: '42',
    name: 'Phúc Long',
    normalizedName: 'phuc long',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
  const placeB: FinancePlaceEntity = {
    id: 'place-b',
    userId: '42',
    name: 'Phúc Long Tea & Coffee',
    normalizedName: 'phuc long tea and coffee',
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
  };

  const transactionsOfB: Partial<FinanceTransactionEntity>[] = [
    { id: 'tx-10', userId: '42', placeId: 'place-b' },
    { id: 'tx-11', userId: '42', placeId: 'place-b' },
  ];

  let removedPlaces: FinancePlaceEntity[] = [];
  let savedTransactions: Partial<FinanceTransactionEntity>[] = [];

  const service = new FinanceService(
    {
      count: (opts: { where: { placeId: string; userId: string } }) => {
        if (opts.where.placeId === 'place-a') return Promise.resolve(1);
        if (opts.where.placeId === 'place-b') return Promise.resolve(10);
        return Promise.resolve(0);
      },
      find: () => Promise.resolve(transactionsOfB),
      save: (txs: Partial<FinanceTransactionEntity>[]) => {
        savedTransactions = txs;
        return Promise.resolve(txs);
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      find: () => Promise.resolve([placeA, placeB]),
      findOne: () => Promise.resolve(null),
      remove: (places: FinancePlaceEntity[]) => {
        removedPlaces = places;
        return Promise.resolve(places);
      },
      save: (p: FinancePlaceEntity) => Promise.resolve(p),
    } as never,
  );

  const result = await service.combinePlaces(42, {
    placeIds: ['place-a', 'place-b'],
    targetPlaceId: 'place-a',
  });

  // Explicit targetPlaceId 'place-a' was selected
  assert.equal(result.leadPlace.id, 'place-a');
  assert.equal(result.leadPlace.name, 'Phúc Long');
  assert.equal(result.mergedPlacesCount, 1);
  assert.equal(result.affectedTransactionsCount, 2);

  // transactions of placeB were reassigned to placeA
  assert.equal(savedTransactions.length, 2);
  assert.equal(savedTransactions[0].placeId, 'place-a');
  assert.equal(savedTransactions[1].placeId, 'place-a');

  // placeB was removed
  assert.equal(removedPlaces[0].id, 'place-b');
});

void test('combineContacts prioritizes contact linked to User as lead over one with more resources', async () => {
  const contactWithUser: DebtContactEntity = {
    id: 'c-user',
    userId: '42',
    displayName: 'Thành (User)',
    normalizedName: 'thanh user',
    linkedUserId: 'user-99',
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
  };

  const contactWithManyResources: DebtContactEntity = {
    id: 'c-many',
    userId: '42',
    displayName: 'Thành bạn thân',
    normalizedName: 'thanh ban than',
    phoneNumber: '0901234567',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const debtsOfMany: Partial<DebtEntity>[] = [
    { id: 'debt-1', userId: '42', contactId: 'c-many', counterparty: 'Thành bạn thân' },
  ];
  const txsOfMany: Partial<FinanceTransactionEntity>[] = [
    { id: 'tx-1', userId: '42', contactId: 'c-many' },
    { id: 'tx-2', userId: '42', contactId: 'c-many' },
  ];

  const savedContacts: DebtContactEntity[] = [];
  let removedContacts: DebtContactEntity[] = [];
  let savedDebts: Partial<DebtEntity>[] = [];
  let savedTxs: Partial<FinanceTransactionEntity>[] = [];

  const service = new FinanceService(
    {
      count: (opts: { where: { contactId: string; userId: string } }) => {
        if (opts.where.contactId === 'c-user') return Promise.resolve(1);
        if (opts.where.contactId === 'c-many') return Promise.resolve(10);
        return Promise.resolve(0);
      },
      find: () => Promise.resolve(txsOfMany),
      save: (txs: Partial<FinanceTransactionEntity>[]) => {
        savedTxs = txs;
        return Promise.resolve(txs);
      },
    } as never,
    {
      count: (opts: { where: { contactId: string; userId: string } }) => {
        if (opts.where.contactId === 'c-user') return Promise.resolve(1);
        if (opts.where.contactId === 'c-many') return Promise.resolve(5);
        return Promise.resolve(0);
      },
      find: () => Promise.resolve(debtsOfMany),
      save: (debts: Partial<DebtEntity>[]) => {
        savedDebts = debts;
        return Promise.resolve(debts);
      },
    } as never,
    {
      find: () => Promise.resolve([contactWithManyResources, contactWithUser]),
      save: (c: DebtContactEntity) => {
        savedContacts.push(c);
        return Promise.resolve(c);
      },
      remove: (contacts: DebtContactEntity[]) => {
        removedContacts = contacts;
        return Promise.resolve(contacts);
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const result = await service.combineContacts(42, {
    contactIds: ['c-user', 'c-many'],
    displayName: 'Thành Đã Gộp',
  });

  // Lead should be c-user despite c-many having far more resources (15 vs 2)
  assert.equal(result.targetContact.id, 'c-user');
  assert.equal(result.targetContact.displayName, 'Thành Đã Gộp');
  assert.equal(result.targetContact.linkedUserId, 'user-99');
  // Inherited phone from c-many
  assert.equal(result.targetContact.phoneNumber, '0901234567');

  // Debts and transactions were reassigned to c-user
  assert.equal(savedDebts.length, 1);
  assert.equal(savedDebts[0].contactId, 'c-user');
  assert.equal(savedDebts[0].counterparty, 'Thành Đã Gộp');

  assert.equal(savedTxs.length, 2);
  assert.equal(savedTxs[0].contactId, 'c-user');
  assert.equal(savedTxs[1].contactId, 'c-user');

  // c-many was removed
  assert.equal(removedContacts.length, 1);
  assert.equal(removedContacts[0].id, 'c-many');
});

void test('combineContacts prioritizes candidate with most total resources when neither has linked user', async () => {
  const contactA: DebtContactEntity = {
    id: 'c-a',
    userId: '42',
    displayName: 'Quán A',
    normalizedName: 'quan a',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const contactB: DebtContactEntity = {
    id: 'c-b',
    userId: '42',
    displayName: 'Quán B',
    normalizedName: 'quan b',
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
  };

  const txsOfA: Partial<FinanceTransactionEntity>[] = [
    { id: 'tx-a1', userId: '42', contactId: 'c-a' },
  ];

  let savedTxs: Partial<FinanceTransactionEntity>[] = [];
  let removedContacts: DebtContactEntity[] = [];

  const service = new FinanceService(
    {
      count: (opts: { where: { contactId: string; userId: string } }) => {
        if (opts.where.contactId === 'c-a') return Promise.resolve(2);
        if (opts.where.contactId === 'c-b') return Promise.resolve(8);
        return Promise.resolve(0);
      },
      find: () => Promise.resolve(txsOfA),
      save: (txs: Partial<FinanceTransactionEntity>[]) => {
        savedTxs = txs;
        return Promise.resolve(txs);
      },
    } as never,
    {
      count: () => Promise.resolve(0),
      find: () => Promise.resolve([]),
      save: () => Promise.resolve([]),
    } as never,
    {
      find: () => Promise.resolve([contactA, contactB]),
      save: (c: DebtContactEntity) => Promise.resolve(c),
      remove: (contacts: DebtContactEntity[]) => {
        removedContacts = contacts;
        return Promise.resolve(contacts);
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const result = await service.combineContacts(42, {
    contactIds: ['c-a', 'c-b'],
  });

  // Lead should be c-b because it has 8 txs vs c-a with 2 txs
  assert.equal(result.targetContact.id, 'c-b');
  assert.equal(removedContacts[0].id, 'c-a');
  assert.equal(savedTxs[0].contactId, 'c-b');
});
