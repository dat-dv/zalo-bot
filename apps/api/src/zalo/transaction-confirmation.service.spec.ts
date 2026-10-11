import assert from 'node:assert/strict';
import test from 'node:test';
import { TransactionConfirmationService } from './transaction-confirmation.service';
import { ZaloService } from './zalo.service';
import { FinanceService } from '../finance/finance.service';

interface TestContext {
  service: TransactionConfirmationService;
  sentMessages: Array<{ chatId: string | number; text: string }>;
  createdTransactions: any[];
  deletedTransactions: Array<{ userId: string | number; id: string }>;
}

function createTestContext(): TestContext {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];
  const createdTransactions: any[] = [];
  const deletedTransactions: Array<{ userId: string | number; id: string }> = [];

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
  } as unknown as ZaloService;

  const mockFinanceService = {
    createTransaction: (dto: any) => {
      createdTransactions.push(dto);
      return Promise.resolve({
        id: 'tx_1',
        amount: dto.amount,
        type: dto.type,
        category: dto.category,
        note: dto.note,
        occurredAt: dto.occurredAt,
      });
    },
    deleteTransaction: (userId: string | number, id: string) => {
      deletedTransactions.push({ userId, id });
      return Promise.resolve(true);
    },
  } as unknown as FinanceService;

  const service = new TransactionConfirmationService(mockZaloService, mockFinanceService);
  service.timeoutMs = 50; // 50ms for tests

  return { service, sentMessages, createdTransactions, deletedTransactions };
}

void test('TransactionConfirmationService creates pending transaction with 3-digit code', async () => {
  const { service, sentMessages, createdTransactions } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
      type: 'expense',
      amount: 15000,
      category: 'Ăn uống',
      note: 'uống cà phê',
    },
  });

  assert.equal(pending.code.length, 3);
  assert.equal(createdTransactions.length, 0); // Not saved yet!
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Xác nhận lưu/);
  assert.match(sentMessages[0].text, /15\.000 đ/);
  assert.match(sentMessages[0].text, new RegExp(`yes ${pending.code}`));

  service.clearAll();
});

void test('TransactionConfirmationService confirms transaction with "yes <mã>"', async () => {
  const { service, sentMessages, createdTransactions } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
      type: 'expense',
      amount: 15000,
      category: 'Ăn uống',
      note: 'uống cà phê',
    },
  });

  const handled = await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(handled, true);
  assert.equal(createdTransactions.length, 1);
  assert.equal(createdTransactions[0].amount, 15000);
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /Đã xác nhận và lưu/);
  assert.match(sentMessages[1].text, /15\.000 đ/);

  service.clearAll();
});

void test('TransactionConfirmationService cancels transaction with "cancel <mã>"', async () => {
  const { service, sentMessages, createdTransactions } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
      type: 'expense',
      amount: 50000,
      category: 'Ăn uống',
      note: 'ăn phở',
    },
  });

  const handled = await service.handleCommand('u1', 'c1', `cancel ${pending.code}`);
  assert.equal(handled, true);
  assert.equal(createdTransactions.length, 0); // Not created!
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /Đã hủy/);

  service.clearAll();
});

void test('TransactionConfirmationService notifies when 1-minute timeout expires', async () => {
  const { service, sentMessages } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
      type: 'expense',
      amount: 30000,
      category: 'Khác',
      note: 'mua sách',
    },
  });

  // Wait for 60ms to let timeout trigger
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /đã hết hạn/);
  assert.match(sentMessages[1].text, new RegExp(pending.code));

  service.clearAll();
});

void test('TransactionConfirmationService creates pending delete with 3-digit code and confirms with "yes <mã>"', async () => {
  const { service, sentMessages, deletedTransactions } = createTestContext();

  const pending = await service.createPendingDelete({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      transactionId: 'tx_delete_123',
      type: 'expense',
      amount: 45000,
      category: 'Ăn uống',
      note: 'ăn phở',
    },
  });

  assert.equal(pending.code.length, 3);
  assert.equal(pending.actionType, 'DELETE_TRANSACTION');
  assert.equal(deletedTransactions.length, 0); // Not deleted yet
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Xác nhận XÓA/i);
  assert.match(sentMessages[0].text, /45\.000 đ/);
  assert.match(sentMessages[0].text, /tx_delete_123/);
  assert.match(sentMessages[0].text, new RegExp(`yes ${pending.code}`));

  // Confirm delete
  const handled = await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(handled, true);
  assert.equal(deletedTransactions.length, 1);
  assert.equal(deletedTransactions[0].id, 'tx_delete_123');
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /Đã xóa/);
  assert.match(sentMessages[1].text, /45\.000 đ/);

  service.clearAll();
});

void test('TransactionConfirmationService cancels delete with "cancel <mã>"', async () => {
  const { service, sentMessages, deletedTransactions } = createTestContext();

  const pending = await service.createPendingDelete({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      transactionId: 'tx_delete_456',
      type: 'income',
      amount: 500000,
      note: 'thưởng',
    },
  });

  const handled = await service.handleCommand('u1', 'c1', `cancel ${pending.code}`);
  assert.equal(handled, true);
  assert.equal(deletedTransactions.length, 0); // Not deleted!
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /Đã hủy/);

  service.clearAll();
});

void test('TransactionConfirmationService notifies when delete timeout expires', async () => {
  const { service, sentMessages } = createTestContext();

  const pending = await service.createPendingDelete({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      transactionId: 'tx_delete_789',
      type: 'expense',
      amount: 100000,
      note: 'mua áo',
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /xóa khoản chi/i);
  assert.match(sentMessages[1].text, /đã hết hạn 1 phút/);

  service.clearAll();
});
