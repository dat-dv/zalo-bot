import assert from 'node:assert/strict';
import test from 'node:test';
import { TransactionConfirmationService } from './transaction-confirmation.service';
import { ZaloService } from './zalo.service';
import { FinanceService } from '../finance/finance.service';
import { RemindersService } from '../reminders/reminders.service';
import { GoogleTasksService } from '../google/google-tasks.service';
import { GoogleCalendarService } from '../google/google-calendar.service';

interface TestContext {
  service: TransactionConfirmationService;
  sentMessages: Array<{ chatId: string | number; text: string }>;
  createdTransactions: any[];
  deletedTransactions: Array<{ userId: string | number; id: string }>;
  createdDebts: any[];
  createdReminders: any[];
  createdTasks: any[];
  createdEvents: any[];
}

function createTestContext(): TestContext {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];
  const createdTransactions: any[] = [];
  const deletedTransactions: Array<{ userId: string | number; id: string }> = [];
  const createdDebts: any[] = [];
  const createdReminders: any[] = [];
  const createdTasks: any[] = [];
  const createdEvents: any[] = [];

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
    createDebt: (dto: any) => {
      createdDebts.push(dto);
      return Promise.resolve({
        id: 'debt_1',
        counterparty: dto.counterparty,
        originalAmount: dto.amount,
        direction: dto.direction,
        note: dto.note,
      });
    },
    deleteTransaction: (userId: string | number, id: string) => {
      deletedTransactions.push({ userId, id });
      return Promise.resolve(true);
    },
  } as unknown as FinanceService;

  const mockRemindersService = {
    createReminder: (dto: any) => {
      createdReminders.push(dto);
      return Promise.resolve({
        id: 'rem_1',
        title: dto.title,
        remindAt: dto.remindAt,
      });
    },
  } as unknown as RemindersService;

  const mockGoogleTasksService = {
    createTask: (options: any, userId: string) => {
      createdTasks.push({ ...options, userId });
      return Promise.resolve({
        id: 'task_1',
        title: options.title,
      });
    },
  } as unknown as GoogleTasksService;

  const mockGoogleCalendarService = {
    createEvent: (options: any, userId: string) => {
      createdEvents.push({ ...options, userId });
      return Promise.resolve({
        id: 'event_1',
        summary: options.summary,
      });
    },
  } as unknown as GoogleCalendarService;

  const service = new TransactionConfirmationService(
    mockZaloService,
    mockFinanceService,
    mockRemindersService,
    mockGoogleTasksService,
    mockGoogleCalendarService,
  );
  service.timeoutMs = 50; // 50ms for tests

  return {
    service,
    sentMessages,
    createdTransactions,
    deletedTransactions,
    createdDebts,
    createdReminders,
    createdTasks,
    createdEvents,
  };
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
  assert.equal(createdTransactions.length, 0); // Not created yet
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Xác nhận lưu/i);
  assert.match(sentMessages[0].text, /15\.000 đ/);
  assert.match(sentMessages[0].text, /uống cà phê/);
  assert.match(sentMessages[0].text, new RegExp(`yes ${pending.code}`));
  assert.match(sentMessages[0].text, new RegExp(`cancel ${pending.code}`));

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
  assert.match(sentMessages[1].text, /Đã hủy giao dịch/);

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
  assert.match(sentMessages[1].text, /Yêu cầu xóa/i);
  assert.match(sentMessages[1].text, /đã hết hạn 1 phút/);

  service.clearAll();
});

void test('TransactionConfirmationService creates and confirms debt with strict shape', async () => {
  const { service, sentMessages, createdDebts } = createTestContext();

  const pending = await service.createPendingDebt({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
      direction: 'receivable',
      counterparty: 'Huy',
      amount: 200000,
      note: 'vay tiền xe',
    },
  });

  assert.equal(pending.code.length, 3);
  assert.equal(createdDebts.length, 0);
  assert.match(sentMessages[0].text, /Xác nhận ghi nhận/i);
  assert.match(sentMessages[0].text, /Họ nợ bạn/);
  assert.match(sentMessages[0].text, /Người liên quan: Huy/);
  assert.match(sentMessages[0].text, /200\.000 đ/);

  // Confirm
  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(createdDebts.length, 1);
  assert.equal(createdDebts[0].counterparty, 'Huy');
  assert.match(sentMessages[1].text, /Đã xác nhận và ghi nhận khoản nợ thành công/);

  service.clearAll();
});

void test('TransactionConfirmationService creates and confirms reminder with strict shape', async () => {
  const { service, sentMessages, createdReminders } = createTestContext();

  const pending = await service.createPendingReminder({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
      title: 'Đi mua quà sinh nhật',
      remindAt: new Date('2026-10-15T18:00:00+07:00'),
    },
  });

  assert.equal(pending.code.length, 3);
  assert.equal(createdReminders.length, 0);
  assert.match(sentMessages[0].text, /Xác nhận đặt lịch nhắc nhở/i);
  assert.match(sentMessages[0].text, /Đi mua quà sinh nhật/);

  // Confirm
  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(createdReminders.length, 1);
  assert.equal(createdReminders[0].title, 'Đi mua quà sinh nhật');
  assert.match(sentMessages[1].text, /Đã xác nhận và đặt lịch nhắc thành công/);

  service.clearAll();
});

void test('TransactionConfirmationService creates and confirms Google Task with strict shape', async () => {
  const { service, sentMessages, createdTasks } = createTestContext();

  const pending = await service.createPendingTask({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      title: 'Hoàn thành báo cáo quý 4',
      due: '2026-10-20T23:59:59.000Z',
    },
  });

  assert.equal(pending.code.length, 3);
  assert.equal(createdTasks.length, 0);
  assert.match(sentMessages[0].text, /Xác nhận thêm việc cần làm/i);
  assert.match(sentMessages[0].text, /Hoàn thành báo cáo quý 4/);

  // Confirm
  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(createdTasks.length, 1);
  assert.equal(createdTasks[0].title, 'Hoàn thành báo cáo quý 4');
  assert.match(sentMessages[1].text, /ĐÃ XÁC NHẬN VÀ THÊM VIỆC CẦN LÀM VÀO GOOGLE TASKS/);

  service.clearAll();
});

void test('TransactionConfirmationService creates and confirms Google Calendar Event with strict shape', async () => {
  const { service, sentMessages, createdEvents } = createTestContext();

  const pending = await service.createPendingCalendarEvent({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      summary: 'Gặp gỡ đối tác',
      startDateTime: '2026-10-16T14:00:00+07:00',
      endDateTime: '2026-10-16T15:30:00+07:00',
      location: 'The Coffee House',
    },
  });

  assert.equal(pending.code.length, 3);
  assert.equal(createdEvents.length, 0);
  assert.match(sentMessages[0].text, /Xác nhận tạo sự kiện Google Calendar/i);
  assert.match(sentMessages[0].text, /Gặp gỡ đối tác/);
  assert.match(sentMessages[0].text, /The Coffee House/);

  // Confirm
  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(createdEvents.length, 1);
  assert.equal(createdEvents[0].summary, 'Gặp gỡ đối tác');
  assert.match(sentMessages[1].text, /ĐÃ XÁC NHẬN VÀ TẠO SỰ KIỆN GOOGLE CALENDAR THÀNH CÔNG/);

  service.clearAll();
});
