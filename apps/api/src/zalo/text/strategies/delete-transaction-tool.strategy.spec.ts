import assert from 'node:assert/strict';
import test from 'node:test';
import { DeleteTransactionToolStrategy } from './delete-transaction-tool.strategy';
import { ZaloService } from '../../zalo.service';
import { FinanceService } from '../../../finance/finance.service';
import { TransactionConfirmationService } from '../../transaction-confirmation.service';
import { FinanceTransactionEntity } from '../../../database/entities/finance-transaction.entity';
import { DeleteTransactionDto } from '../../confirmation/dto-descriptor.util';
import { AgentInput } from '../../types/agent-input.type';

interface PendingDeleteParam {
  userId: string;
  chatId: string;
  payload?: DeleteTransactionDto;
  deletePayload?: DeleteTransactionDto;
  rawPrompt?: string;
}

interface TestContext {
  strategy: DeleteTransactionToolStrategy;
  sentMessages: Array<{ chatId: string | number; text: string }>;
  pendingDeletes: PendingDeleteParam[];
}

function createTestContext(
  mockTransactions: Record<string, FinanceTransactionEntity> = {},
): TestContext {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];
  const pendingDeletes: PendingDeleteParam[] = [];

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
  } as unknown as ZaloService;

  const mockFinanceService = {
    getTransaction: (id: string) => {
      return Promise.resolve(mockTransactions[id] || null);
    },
    getLatestTransaction: () => {
      const values = Object.values(mockTransactions);
      return Promise.resolve(values[values.length - 1] || null);
    },
    listTransactions: () => {
      return Promise.resolve(Object.values(mockTransactions));
    },
  } as unknown as FinanceService;

  const mockConfirmationService = {
    createPendingDelete: (params: PendingDeleteParam) => {
      pendingDeletes.push(params);
      return Promise.resolve({ code: '999' } as never);
    },
  } as unknown as TransactionConfirmationService;

  const strategy = new DeleteTransactionToolStrategy(
    mockZaloService,
    mockFinanceService,
    mockConfirmationService,
  );

  return { strategy, sentMessages, pendingDeletes };
}

void test('DeleteTransactionToolStrategy creates pending delete when transactionId is provided in toolArgs', async () => {
  const dummyTx = {
    id: '88ca5db0-5e4a-4f10-af57-48fcb57e48b7',
    type: 'expense',
    amount: 50000,
    currency: 'VND',
    category: 'Ăn uống',
    note: 'Cà phê sáng',
    occurredAt: new Date('2026-10-12T02:00:00Z'),
  } as FinanceTransactionEntity;

  const { strategy, pendingDeletes, sentMessages } = createTestContext({
    '88ca5db0-5e4a-4f10-af57-48fcb57e48b7': dummyTx,
  });

  await strategy.execute({
    input: {
      type: 'text',
      text: 'Xóa giao dịch 88ca5db0-5e4a-4f10-af57-48fcb57e48b7',
    } as AgentInput,
    chatId: 'c1',
    senderId: 'u1',
    displayName: 'Đạt',
    text: 'Xóa giao dịch 88ca5db0-5e4a-4f10-af57-48fcb57e48b7',
    toolArgs: {
      transactionId: '88ca5db0-5e4a-4f10-af57-48fcb57e48b7',
    },
  });

  assert.equal(pendingDeletes.length, 1);
  assert.equal(pendingDeletes[0].userId, 'u1');
  assert.equal(pendingDeletes[0].payload?.transactionId, '88ca5db0-5e4a-4f10-af57-48fcb57e48b7');
  assert.equal(pendingDeletes[0].payload?.amount, 50000);
  assert.equal(sentMessages.length, 0); // Confirmation message is sent by confirmationService
});

void test('DeleteTransactionToolStrategy extracts UUID from raw user text if toolArgs transactionId is missing', async () => {
  const dummyTx = {
    id: '88ca5db0-5e4a-4f10-af57-48fcb57e48b7',
    type: 'expense',
    amount: 75000,
    currency: 'VND',
    category: 'Mua sắm',
    note: 'Mua sách',
    occurredAt: new Date('2026-10-12T02:00:00Z'),
  } as FinanceTransactionEntity;

  const { strategy, pendingDeletes } = createTestContext({
    '88ca5db0-5e4a-4f10-af57-48fcb57e48b7': dummyTx,
  });

  // User input matching user prompt from report
  await strategy.execute({
    input: {
      type: 'text',
      text: 'Xóa Giao dịch thu–chi (finance_transactions) có ID: 88ca5db0-5e4a-4f10-af57-48fcb57e48b7',
    } as AgentInput,
    chatId: 'c1',
    senderId: 'u1',
    displayName: 'Đạt',
    text: 'Xóa Giao dịch thu–chi (finance_transactions) có ID: 88ca5db0-5e4a-4f10-af57-48fcb57e48b7',
    toolArgs: {},
  });

  assert.equal(pendingDeletes.length, 1);
  assert.equal(pendingDeletes[0].payload?.transactionId, '88ca5db0-5e4a-4f10-af57-48fcb57e48b7');
  assert.equal(pendingDeletes[0].payload?.amount, 75000);
});

void test('DeleteTransactionToolStrategy sends warning message when transaction is not found', async () => {
  const { strategy, pendingDeletes, sentMessages } = createTestContext({});

  await strategy.execute({
    input: {
      type: 'text',
      text: 'Xóa giao dịch có ID: 00000000-0000-0000-0000-000000000000',
    } as AgentInput,
    chatId: 'c1',
    senderId: 'u1',
    displayName: 'Đạt',
    text: 'Xóa giao dịch có ID: 00000000-0000-0000-0000-000000000000',
    toolArgs: {
      transactionId: '00000000-0000-0000-0000-000000000000',
    },
  });

  assert.equal(pendingDeletes.length, 0);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Không tìm thấy giao dịch/);
});
