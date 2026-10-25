import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TransactionConfirmationService,
  describePendingAction,
  parseReminderPayload,
  toValidRemindTimes,
} from './transaction-confirmation.service';
import {
  FinanceService,
  CreateFinanceTransactionDto,
  CreateDebtDto,
} from '../../finance/finance.service';
import { RemindersService, CreateReminderDto } from '../../reminders/reminders.service';
import type { TaskActor, TaskInput, TasksService } from '../../tasks/tasks.service';
import type {
  CalendarActor,
  CalendarEventInput,
  CalendarService,
} from '../../calendar/calendar.service';
import { UsersService } from '../../users/users.service';
import { GoogleAuthService } from '../../google/google-auth.service';
import { RedisService } from '../../redis/redis.service';
import { ZcaService } from '../zca.service';
import { ThreadConfigService } from '../thread-config.service';
import { FINANCE_TRANSACTION_DESCRIPTOR } from './dto-descriptor.util';
import { AuditContext, zaloAuditContext, type AuditContextStore } from '../../audit/audit-context';

interface TestContext {
  service: TransactionConfirmationService;
  sentMessages: Array<{ chatId: string | number; text: string }>;
  createdTransactions: CreateFinanceTransactionDto[];
  /** Audit context seen by each `createTransaction` call. */
  transactionAuditContexts: Array<AuditContextStore | undefined>;
  deletedTransactions: Array<{ id: string }>;
  createdDebts: CreateDebtDto[];
  createdReminders: CreateReminderDto[];
  createdTasks: Array<TaskInput & { actor: TaskActor }>;
  completedTasks: Array<{ taskId: string; userId: string }>;
  createdEvents: Array<CalendarEventInput & { actor: CalendarActor }>;
  deletedCalendarEvents: Array<{ eventId: string; userId: string }>;
  bannedUsers: string[];
  revokedTokens: string[];
}

function createTestContext(
  redisService?: RedisService,
  threadConfigService?: ThreadConfigService,
): TestContext {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];
  const createdTransactions: CreateFinanceTransactionDto[] = [];
  const transactionAuditContexts: Array<AuditContextStore | undefined> = [];
  const deletedTransactions: Array<{ id: string }> = [];
  const createdDebts: CreateDebtDto[] = [];
  const createdReminders: CreateReminderDto[] = [];
  const createdTasks: Array<TaskInput & { actor: TaskActor }> = [];
  const completedTasks: Array<{ taskId: string; userId: string }> = [];
  const createdEvents: Array<CalendarEventInput & { actor: CalendarActor }> = [];
  const deletedCalendarEvents: Array<{ eventId: string; userId: string }> = [];
  const bannedUsers: string[] = [];
  const revokedTokens: string[] = [];

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
  } as unknown as ZcaService;

  const mockFinanceService = {
    createTransaction: (dto: CreateFinanceTransactionDto) => {
      createdTransactions.push(dto);
      transactionAuditContexts.push(AuditContext.current());
      return Promise.resolve({
        id: 'tx_1',
        amount: dto.amount,
        type: dto.type,
        category: dto.category,
        note: dto.note,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      } as never);
    },
    createDebt: (dto: CreateDebtDto) => {
      createdDebts.push(dto);
      return Promise.resolve({
        id: 'debt_1',
        counterparty: dto.counterparty,
        originalAmount: dto.amount,
        direction: dto.direction,
        note: dto.note,
      } as never);
    },
    deleteTransaction: (id: string) => {
      deletedTransactions.push({ id });
      return Promise.resolve(true);
    },
  } as unknown as FinanceService;

  const mockRemindersService = {
    createReminder: (dto: CreateReminderDto) => {
      createdReminders.push(dto);
      return Promise.resolve({
        id: 'rem_1',
        title: dto.title,
        remindAt: dto.remindAt,
      } as never);
    },
  } as unknown as RemindersService;

  const mockTasksService = {
    createTask: (input: TaskInput, actor: TaskActor) => {
      createdTasks.push({ ...input, actor });
      return Promise.resolve({ id: 'task_1', title: input.title } as never);
    },
    completeTask: (taskId: string, userId: string) => {
      completedTasks.push({ taskId, userId });
      return Promise.resolve({ id: taskId } as never);
    },
  } as unknown as TasksService;

  const mockCalendarService = {
    createEvent: (input: CalendarEventInput, actor: CalendarActor) => {
      createdEvents.push({ ...input, actor });
      return Promise.resolve({ id: 'event_1', title: input.title } as never);
    },
    deleteEvent: (eventId: string, userId: string) => {
      deletedCalendarEvents.push({ eventId, userId });
      return Promise.resolve({ id: eventId } as never);
    },
  } as unknown as CalendarService;

  const mockUsersService = {
    banUser: (userId: string) => {
      bannedUsers.push(userId);
      return Promise.resolve(true);
    },
  } as unknown as UsersService;

  const mockGoogleAuthService = {
    revokeUserTokens: (userId: string) => {
      revokedTokens.push(userId);
      return Promise.resolve(true);
    },
  } as unknown as GoogleAuthService;

  const service = new TransactionConfirmationService(
    mockZaloService,
    mockFinanceService,
    mockRemindersService,
    mockTasksService,
    mockCalendarService,
    mockUsersService,
    mockGoogleAuthService,
    redisService,
    threadConfigService,
  );
  service.timeoutMs = 50; // 50ms for tests

  return {
    service,
    sentMessages,
    createdTransactions,
    transactionAuditContexts,
    deletedTransactions,
    createdDebts,
    createdReminders,
    createdTasks,
    completedTasks,
    createdEvents,
    deletedCalendarEvents,
    bannedUsers,
    revokedTokens,
  };
}

void test('TransactionConfirmationService creates pending transaction with 3-digit code', async () => {
  const { service, sentMessages, createdTransactions } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 15000,
      category: 'Ăn uống',
      note: 'uống cà phê',
    },
  });

  assert.equal(pending.code.length, 3);
  assert.equal(createdTransactions.length, 0); // Not created yet
  assert.equal(sentMessages.length, 1);
  assert.equal(
    sentMessages[0].text,
    `Lưu khoản chi [${pending.code}]?\n` +
      '• Số tiền: 15.000 đ\n' +
      '• Danh mục: Ăn uống\n' +
      '• Ghi chú: uống cà phê\n' +
      `❤️ hoặc yes ${pending.code}: duyệt · 😡 hoặc cancel ${pending.code}: huỷ\n` +
      `edit ${pending.code} <nội dung>: sửa · tự huỷ sau 5 phút`,
  );

  service.clearAll();
});

void test('TransactionConfirmationService confirms transaction with "yes <mã>"', async () => {
  const { service, sentMessages, createdTransactions } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
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
  // occurredAt defaults to "now", so only the first line is fixed.
  assert.equal(
    sentMessages[1].text.split('\n')[0],
    `✅ [${pending.code}] Chi 15.000đ · Ăn uống · uống cà phê`,
  );
  assert.ok(sentMessages[1].text.split('\n').length <= 2);

  service.clearAll();
});

void test('a confirmed action is credited to its requester, not to whoever approved it', async () => {
  const { service, createdTransactions, transactionAuditContexts } = createTestContext();
  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: { type: 'expense', amount: 15000, category: 'Ăn uống', note: 'cà phê' },
  });

  // u2 approves in the same group, inside the Zalo context of their own message. Their name
  // must not be recorded as the requester's.
  await AuditContext.run(zaloAuditContext('u2', 'c1', 'Bình'), () =>
    service.handleCommand('u2', 'c1', `yes ${pending.code}`),
  );

  assert.equal(createdTransactions.length, 1);
  assert.deepEqual(transactionAuditContexts, [{ source: 'zalo', actorId: 'u1', channelId: 'c1' }]);

  service.clearAll();
});

void test('a requester confirming their own action keeps their Zalo name', async () => {
  const { service, transactionAuditContexts } = createTestContext();
  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: { type: 'expense', amount: 15000, category: 'Ăn uống', note: 'cà phê' },
  });

  await AuditContext.run(zaloAuditContext('u1', 'c1', 'An'), () =>
    service.handleCommand('u1', 'c1', `yes ${pending.code}`),
  );

  assert.deepEqual(transactionAuditContexts, [
    { source: 'zalo', actorId: 'u1', actorName: 'An', channelId: 'c1' },
  ]);

  service.clearAll();
});

void test('TransactionConfirmationService cancels transaction with "cancel <mã>"', async () => {
  const { service, sentMessages, createdTransactions } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
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
  assert.equal(sentMessages[1].text, `[${pending.code}] Đã huỷ: lưu khoản chi "ăn phở"`);

  service.clearAll();
});

void test('TransactionConfirmationService notifies when timeout expires', async () => {
  const { service, sentMessages } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 30000,
      category: 'Khác',
      note: 'mua sách',
    },
  });

  // Wait for 60ms to let timeout trigger
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /^\[\d{3}\] Hết hạn, chưa lưu: lưu khoản chi/);
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
  assert.match(sentMessages[0].text, /^Xoá khoản (thu|chi) \[\d{3}\]\?/);
  assert.match(sentMessages[0].text, /45\.000 đ/);
  assert.match(sentMessages[0].text, /tx_delete_123/);
  assert.match(sentMessages[0].text, new RegExp(`yes ${pending.code}`));

  // Confirm delete
  const handled = await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(handled, true);
  assert.equal(deletedTransactions.length, 1);
  assert.equal(deletedTransactions[0].id, 'tx_delete_123');
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /^🗑️ \[\d{3}\] Đã xoá chi 45\.000đ/);

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
  assert.match(sentMessages[1].text, /^\[\d{3}\] Đã huỷ: /);

  service.clearAll();
});

void test('TransactionConfirmationService notifies when delete timeout expires', async () => {
  const { service, sentMessages } = createTestContext();

  const _pending = await service.createPendingDelete({
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
  assert.match(sentMessages[1].text, /^\[\d{3}\] Hết hạn, chưa lưu: xoá khoản chi/);

  service.clearAll();
});

void test('TransactionConfirmationService creates and confirms debt with strict shape', async () => {
  const { service, sentMessages, createdDebts } = createTestContext();

  const pending = await service.createPendingDebt({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      direction: 'receivable',
      counterparty: 'Huy',
      amount: 200000,
      note: 'vay tiền xe',
    },
  });

  assert.equal(pending.code.length, 3);
  assert.equal(createdDebts.length, 0);
  assert.match(sentMessages[0].text, /^Ghi công nợ \[\d{3}\]\?/);
  assert.match(sentMessages[0].text, /Họ nợ bạn/);
  assert.match(sentMessages[0].text, /Người liên quan: Huy/);
  assert.match(sentMessages[0].text, /200\.000 đ/);

  // Confirm
  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(createdDebts.length, 1);
  assert.equal(createdDebts[0].counterparty, 'Huy');
  assert.match(sentMessages[1].text, /^✅ \[\d{3}\] Huy nợ bạn 200\.000đ · vay tiền xe/);

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
  assert.match(sentMessages[0].text, /^Đặt lời nhắc \[\d{3}\]\?/);
  assert.match(sentMessages[0].text, /Đi mua quà sinh nhật/);

  // Confirm
  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(createdReminders.length, 1);
  assert.equal(createdReminders[0].title, 'Đi mua quà sinh nhật');
  assert.match(sentMessages[1].text, /^⏰ \[\d{3}\] Nhắc "Đi mua quà sinh nhật" lúc 18:00 15\/10/);

  service.clearAll();
});

void test('TransactionConfirmationService confirms reminder whose payload round-tripped through Redis', async () => {
  const redisStorage = new Map<string, string>();
  const redisService = {
    get: (key: string) => Promise.resolve(redisStorage.get(key) || null),
    set: (key: string, val: string) => {
      redisStorage.set(key, val);
      return Promise.resolve('OK');
    },
    del: (key: string) => {
      redisStorage.delete(key);
      return Promise.resolve(1);
    },
  } as unknown as RedisService;
  const { service, sentMessages, createdReminders } = createTestContext(redisService);
  const remindAt = new Date('2026-10-19T17:00:00+07:00');

  const pending = await service.createPendingReminder({
    userId: 'u1',
    chatId: 'c1',
    payload: { userId: 'u1', title: 'Nhắn Mẹ đừng nấu cơm', remindAt },
  });

  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(createdReminders.length, 1);
  assert.ok(createdReminders[0].remindAt instanceof Date);
  assert.equal(createdReminders[0].remindAt.getTime(), remindAt.getTime());
  assert.match(
    sentMessages[sentMessages.length - 1].text,
    /^⏰ \[\d{3}\] Nhắc "Nhắn Mẹ đừng nấu cơm" lúc 17:00 19\/10/,
  );

  service.clearAll();
});

void test('parseReminderPayload keeps the target of a group reminder', () => {
  const parsed = parseReminderPayload({
    userId: 'u1',
    title: 'Họp',
    remindAt: '2026-10-19T10:00:00.000Z',
    chatId: 'g1',
    originChatId: 'g1',
    remindUsers: [{ id: '222', name: 'Trí' }, { bogus: true }],
    remindMode: 'direct',
  });
  assert.equal(parsed.chatId, 'g1');
  assert.equal(parsed.originChatId, 'g1');
  assert.deepEqual(parsed.remindUsers, [{ id: '222', name: 'Trí' }]);
  assert.equal(parsed.remindMode, 'direct');
  const personal = parseReminderPayload({ userId: 'u1', title: 'x', remindAt: new Date() });
  assert.equal(personal.chatId, undefined);
  assert.equal(personal.remindUsers, undefined);
});

void test('parseReminderPayload revives ISO remindAt and rejects invalid values', () => {
  const parsed = parseReminderPayload({
    userId: 'u1',
    title: 'Đi chợ',
    remindAt: '2026-10-19T10:00:00.000Z',
    notifyType: 'call',
    repeatType: 'bogus',
  });
  assert.ok(parsed.remindAt instanceof Date);
  assert.equal(parsed.remindAt.toISOString(), '2026-10-19T10:00:00.000Z');
  assert.equal(parsed.notifyType, 'call');
  assert.equal(parsed.repeatType, undefined);

  assert.throws(() =>
    parseReminderPayload({ userId: 'u1', title: 'x', remindAt: 'không phải ngày' }),
  );
  assert.throws(() => parseReminderPayload({ userId: 'u1', title: 'x', remindAt: 123 }));
  assert.throws(() => parseReminderPayload({ userId: 'u1', title: '  ', remindAt: new Date() }));
});

void test('TransactionConfirmationService creates and confirms a task with strict shape', async () => {
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
  assert.match(sentMessages[0].text, /^Thêm việc \[\d{3}\]\?/);
  assert.match(sentMessages[0].text, /Hoàn thành báo cáo quý 4/);

  // Confirm
  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(createdTasks.length, 1);
  assert.equal(createdTasks[0].title, 'Hoàn thành báo cáo quý 4');
  assert.equal(createdTasks[0].dueAt?.toISOString(), '2026-10-20T23:59:59.000Z');
  assert.deepEqual(createdTasks[0].actor, { userId: 'u1', chatId: 'c1', source: 'zalo' });
  assert.match(sentMessages[1].text, /^✅ \[\d{3}\] Thêm việc: Hoàn thành báo cáo quý 4/);

  service.clearAll();
});

void test('TransactionConfirmationService creates and confirms calendar event with strict shape', async () => {
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
  assert.match(sentMessages[0].text, /^Thêm lịch \[\d{3}\]\?/);
  assert.match(sentMessages[0].text, /Gặp gỡ đối tác/);
  assert.match(sentMessages[0].text, /The Coffee House/);

  // Confirm
  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(createdEvents.length, 1);
  assert.equal(createdEvents[0].title, 'Gặp gỡ đối tác');
  assert.equal(createdEvents[0].startAt.toISOString(), '2026-10-16T07:00:00.000Z');
  assert.deepEqual(createdEvents[0].actor, { userId: 'u1', chatId: 'c1', source: 'zalo' });
  assert.equal(
    sentMessages[1].text,
    `📅 [${pending.code}] Gặp gỡ đối tác · 14:00–15:30 16/10\nThe Coffee House`,
  );

  service.clearAll();
});

void test('TransactionConfirmationService creates and confirms task completion with strict shape', async () => {
  const { service, sentMessages, completedTasks } = createTestContext();

  const pending = await service.createPendingCompleteTask({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      taskId: 'task_complete_999',
      taskTitle: 'Gửi email báo giá',
    },
  });

  assert.equal(pending.code.length, 3);
  assert.equal(completedTasks.length, 0);
  assert.match(sentMessages[0].text, /^Đánh dấu xong việc \[\d{3}\]\?/);
  assert.match(sentMessages[0].text, /Gửi email báo giá/);
  assert.match(sentMessages[0].text, /task_complete_999/);

  // Confirm
  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(completedTasks.length, 1);
  assert.equal(completedTasks[0].taskId, 'task_complete_999');
  assert.match(sentMessages[1].text, /^☑️ \[\d{3}\] Đã xong: Gửi email báo giá$/);

  service.clearAll();
});

void test('TransactionConfirmationService creates and confirms calendar event deletion with strict shape', async () => {
  const { service, sentMessages, deletedCalendarEvents } = createTestContext();

  const pending = await service.createPendingDeleteCalendarEvent({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      eventId: 'cal_event_del_123',
      summary: 'Họp giao ban sáng',
      location: 'Phòng họp A',
    },
  });

  assert.equal(pending.code.length, 3);
  assert.equal(deletedCalendarEvents.length, 0);
  assert.match(sentMessages[0].text, /^Xoá lịch \[\d{3}\]\?/);
  assert.match(sentMessages[0].text, /Họp giao ban sáng/);
  assert.match(sentMessages[0].text, /Phòng họp A/);

  // Confirm
  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(deletedCalendarEvents.length, 1);
  assert.equal(deletedCalendarEvents[0].eventId, 'cal_event_del_123');
  assert.match(sentMessages[1].text, /^🗑️ \[\d{3}\] Đã xoá lịch: Họp giao ban sáng/);

  service.clearAll();
});

void test('TransactionConfirmationService creates and confirms user ban with strict shape', async () => {
  const { service, sentMessages, bannedUsers, revokedTokens } = createTestContext();

  const pending = await service.createPendingBanUser({
    userId: 'admin_1',
    chatId: 'c1',
    payload: {
      targetUserId: 'bad_user_456',
      targetName: 'Hacker',
      role: 'user',
      reason: 'Spam hệ thống',
    },
  });

  assert.equal(pending.code.length, 3);
  assert.equal(bannedUsers.length, 0);
  assert.match(sentMessages[0].text, /^Khoá tài khoản \[\d{3}\]\?/);
  assert.match(sentMessages[0].text, /bad_user_456/);
  assert.match(sentMessages[0].text, /Hacker/);
  assert.match(sentMessages[0].text, /Spam hệ thống/);

  // Confirm
  await service.handleCommand('admin_1', 'c1', `yes ${pending.code}`);
  assert.equal(bannedUsers.length, 1);
  assert.equal(bannedUsers[0], 'bad_user_456');
  assert.equal(revokedTokens.length, 1);
  assert.equal(revokedTokens[0], 'bad_user_456');
  assert.equal(
    sentMessages[1].text,
    `⛔ [${pending.code}] Đã khoá Hacker (id bad_user_456) · đã thu hồi quyền và token Google\nLý do: Spam hệ thống`,
  );

  service.clearAll();
});

void test('TransactionConfirmationService edits transaction with "edit <mã> <nội dung>" and calls onEdit', async () => {
  const { service, sentMessages } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    rawPrompt: 'ăn trưa 45k',
    payload: {
      type: 'expense',
      amount: 45000,
      category: 'Ăn uống',
      note: 'ăn trưa',
    },
  });

  assert.match(sentMessages[0].text, new RegExp(`edit ${pending.code}`));

  let calledWithPending: unknown = null;
  let calledWithInstruction = '';

  const handled = await service.handleCommand(
    'u1',
    'c1',
    `edit ${pending.code} đổi thành ăn bún bò 55k`,
    (p, instruction) => {
      calledWithPending = p;
      calledWithInstruction = instruction;
      return Promise.resolve();
    },
  );

  assert.equal(handled, true);
  assert.ok(calledWithPending);
  assert.equal(calledWithInstruction, 'đổi thành ăn bún bò 55k');
  // Pending should have been cleared
  const lookup = await service.getPendingByCode(pending.code);
  assert.equal(lookup, undefined);

  service.clearAll();
});

void test('TransactionConfirmationService prompts for content when "edit <mã>" has no instruction', async () => {
  const { service, sentMessages } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 45000,
      category: 'Ăn uống',
      note: 'ăn trưa',
    },
  });

  const handled = await service.handleCommand('u1', 'c1', `edit ${pending.code}`);
  assert.equal(handled, true);
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /^Muốn sửa gì\? Ví dụ: edit \d{3} /);

  // Pending is NOT cleared when user forgets to provide instruction
  const lookup = await service.getPendingByCode(pending.code);
  assert.ok(lookup);

  service.clearAll();
});

void test('TransactionConfirmationService edits without code using user latest pending action', async () => {
  const { service } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 45000,
      category: 'Ăn uống',
      note: 'ăn trưa',
    },
  });

  let calledWithInstruction = '';
  const handled = await service.handleCommand(
    'u1',
    'c1',
    'edit đổi thành cà phê 30k',
    (_p, instruction) => {
      calledWithInstruction = instruction;
      return Promise.resolve();
    },
  );

  assert.equal(handled, true);
  assert.equal(calledWithInstruction, 'đổi thành cà phê 30k');
  const lookup = await service.getPendingByCode(pending.code);
  assert.equal(lookup, undefined);

  service.clearAll();
});

void test('TransactionConfirmationService rejects edit from another user or wrong code', async () => {
  const { service, sentMessages } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 45000,
      category: 'Ăn uống',
      note: 'ăn trưa',
    },
  });

  // Unauthorized user
  const handledOtherUser = await service.handleCommand('u2', 'c2', `edit ${pending.code} đổi 60k`);
  assert.equal(handledOtherUser, true);
  assert.match(sentMessages[1].text, /Bạn không sửa được yêu cầu \[\d{3}\]/);

  // Wrong code
  const handledWrongCode = await service.handleCommand('u1', 'c1', 'edit 999 đổi 60k');
  assert.equal(handledWrongCode, true);
  assert.equal(sentMessages[2].text, '⚠️ Không có yêu cầu [999] đang chờ.');

  service.clearAll();
});

void test('TransactionConfirmationService cancels pending action via ANGRY reaction', async () => {
  const { service, sentMessages } = createTestContext();

  const pending = await service.createPendingAction({
    userId: 'u1',
    chatId: 'c1',
    actionType: 'RECORD_TRANSACTION',
    title: 'lưu khoản chi',
    payload: {
      type: 'expense',
      amount: 50000,
      category: 'Ăn uống',
      note: 'Ăn trưa',
    },
    descriptor: FINANCE_TRANSACTION_DESCRIPTOR,
    messageId: 'msg-101',
  });

  const res = await service.handleReaction({
    chatId: 'c1',
    userId: 'u1',
    reactionIcon: ':-h', // ANGRY
    msgId: 'msg-101',
  });

  assert.equal(res.handled, true);
  assert.equal(res.status, 'cancelled');
  assert.equal(res.code, pending.code);

  const lookup = await service.getPendingByCode(pending.code);
  assert.equal(lookup, undefined);
  assert.match(sentMessages[1].text, /^\[\d{3}\] Đã huỷ: /);

  service.clearAll();
});

void test('TransactionConfirmationService ignores reactions on messages other than the pending card', async () => {
  const { service, createdTransactions, sentMessages } = createTestContext();

  const pending = await service.createPendingAction({
    userId: 'u1',
    chatId: 'c1',
    actionType: 'RECORD_TRANSACTION',
    title: 'lưu khoản chi',
    payload: { type: 'expense', amount: 70000, category: 'Ăn uống', note: 'Trưa' },
    descriptor: FINANCE_TRANSACTION_DESCRIPTOR,
    messageId: 'card-125',
  });
  await service.setMessageId(pending.code, 'card-125', 'cli-card-125');
  const sentBefore = sentMessages.length;

  const heart = await service.handleReaction({
    chatId: 'c1',
    userId: 'u1',
    reactionIcon: '/-heart',
    msgId: 'success-notice-783',
    cliMsgId: 'cli-success-783',
  });
  const angry = await service.handleReaction({
    chatId: 'c1',
    userId: 'u1',
    reactionIcon: ':-h',
    msgId: 'success-notice-783',
  });
  const noTarget = await service.handleReaction({
    chatId: 'c1',
    userId: 'u1',
    reactionIcon: '/-heart',
  });

  assert.equal(heart.handled, false);
  assert.equal(angry.handled, false);
  assert.equal(noTarget.handled, false);
  assert.equal(createdTransactions.length, 0);
  assert.equal(sentMessages.length, sentBefore);
  const still = await service.getPendingByCode(pending.code);
  assert.ok(still, 'pending must stay open');
  assert.equal(
    still.cliMsgId,
    'cli-card-125',
    'cliMsgId must not be overwritten by a foreign message',
  );

  service.clearAll();
});

void test('TransactionConfirmationService matches a reaction on the card by cliMsgId', async () => {
  const { service, createdTransactions } = createTestContext();

  const pending = await service.createPendingAction({
    userId: 'u1',
    chatId: 'c1',
    actionType: 'RECORD_TRANSACTION',
    title: 'lưu khoản chi',
    payload: { type: 'expense', amount: 30000, category: 'Đi lại', note: 'Grab' },
    descriptor: FINANCE_TRANSACTION_DESCRIPTOR,
    messageId: 'card-200',
  });
  await service.setMessageId(pending.code, 'card-200', 'cli-card-200');

  const res = await service.handleReaction({
    chatId: 'c1',
    userId: 'u1',
    reactionIcon: '/-heart',
    msgId: 'global-id-unknown',
    cliMsgId: 'cli-card-200',
  });

  assert.equal(res.handled, true);
  assert.equal(res.status, 'confirmed');
  assert.equal(res.code, pending.code);
  assert.equal(createdTransactions.length, 1);

  service.clearAll();
});

void test('TransactionConfirmationService confirms pending action via HEART reactions threshold', async () => {
  const { service, createdTransactions } = createTestContext();

  const pending = await service.createPendingAction({
    userId: 'u1',
    chatId: 'c1',
    actionType: 'RECORD_TRANSACTION',
    title: 'lưu khoản chi',
    payload: {
      type: 'expense',
      amount: 100000,
      category: 'Ăn uống',
      note: 'Ăn trưa',
    },
    descriptor: FINANCE_TRANSACTION_DESCRIPTOR,
    requiredHearts: 3,
    messageId: 'msg-202',
  });

  // 1st heart from user 1
  const r1 = await service.handleReaction({
    chatId: 'c1',
    userId: 'u1',
    reactionIcon: '/-heart',
    msgId: 'msg-202',
  });
  assert.equal(r1.handled, true);
  assert.equal(r1.status, 'heart_added');
  assert.equal(r1.currentHearts, 1);
  assert.equal(r1.requiredHearts, 3);

  // Duplicate heart from same user does not double count
  const r1Dup = await service.handleReaction({
    chatId: 'c1',
    userId: 'u1',
    reactionIcon: '/-heart',
    msgId: 'msg-202',
  });
  assert.equal(r1Dup.currentHearts, 1);

  // 2nd heart from user 2
  const r2 = await service.handleReaction({
    chatId: 'c1',
    userId: 'u2',
    reactionIcon: '/-heart',
    msgId: 'msg-202',
  });
  assert.equal(r2.status, 'heart_added');
  assert.equal(r2.currentHearts, 2);

  // 3rd heart from user 3 -> reaches threshold (3) -> confirms!
  const r3 = await service.handleReaction({
    chatId: 'c1',
    userId: 'u3',
    reactionIcon: '/-heart',
    msgId: 'msg-202',
  });
  assert.equal(r3.status, 'confirmed');
  assert.equal(r3.currentHearts, 3);

  // Transaction should be recorded in financeService
  assert.equal(createdTransactions.length, 1);
  assert.equal(createdTransactions[0].amount, 100000);

  // Pending should be cleared
  const lookup = await service.getPendingByCode(pending.code);
  assert.equal(lookup, undefined);

  service.clearAll();
});

void test('TransactionConfirmationService preserves pending action if edit is called without onEdit handler', async () => {
  const { service, sentMessages } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 45000,
      category: 'Ăn uống',
      note: 'ăn trưa',
    },
  });

  const handled = await service.handleCommand('u1', 'c1', `edit ${pending.code} đổi thành 60k`);
  assert.equal(handled, true);

  // Pending should NOT be deleted if onEdit is not available
  const lookup = await service.getPendingByCode(pending.code);
  assert.ok(lookup, 'Pending action must be preserved when onEdit is missing');
  assert.equal(lookup.code, pending.code);

  const lastMsg = sentMessages[sentMessages.length - 1];
  assert.match(lastMsg.text, new RegExp(`Yêu cầu \\[${pending.code}\\] chưa sửa tự động được`));

  service.clearAll();
});

void test('TransactionConfirmationService preserves pending action if onEdit throws an error', async () => {
  const { service, sentMessages } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 45000,
      category: 'Ăn uống',
      note: 'ăn trưa',
    },
  });

  const handled = await service.handleCommand(
    'u1',
    'c1',
    `edit ${pending.code} đổi thành 60k`,
    () => Promise.reject(new Error('AI parsing failed')),
  );
  assert.equal(handled, true);

  // Pending should NOT be deleted if onEdit fails
  const lookup = await service.getPendingByCode(pending.code);
  assert.ok(lookup, 'Pending action must be preserved when onEdit throws');

  const lastMsg = sentMessages[sentMessages.length - 1];
  assert.equal(lastMsg.text, '⚠️ Chưa sửa được yêu cầu: AI parsing failed');

  service.clearAll();
});

void test('TransactionConfirmationService captures messageId from sendMessageWithResult and matches reaction by msgId', async () => {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];
  const createdTransactions: CreateFinanceTransactionDto[] = [];

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
    sendMessageWithResult: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve({ success: true, msgId: 'bot-msg-888' });
    },
  } as unknown as ZcaService;

  const mockFinanceService = {
    createTransaction: (dto: CreateFinanceTransactionDto) => {
      createdTransactions.push(dto);
      return Promise.resolve({ id: 'tx_1', ...dto });
    },
  } as unknown as FinanceService;

  const service = new TransactionConfirmationService(
    mockZaloService,
    mockFinanceService,
    {} as unknown as RemindersService,
    {} as unknown as TasksService,
    {} as unknown as CalendarService,
    {} as unknown as UsersService,
    {} as unknown as GoogleAuthService,
  );

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 50000,
      category: 'Ăn uống',
      note: 'cơm trưa',
    },
  });

  // Check messageId was captured
  assert.equal(pending.messageId, 'bot-msg-888');

  // React to the message using targetMsgId matching bot-msg-888
  const reactionResult = await service.handleReaction({
    chatId: 'c1',
    userId: 'u1',
    reactionIcon: '/-heart',
    msgId: 'bot-msg-888',
  });

  assert.equal(reactionResult.handled, true);
  assert.equal(reactionResult.status, 'confirmed');
  assert.equal(createdTransactions.length, 1);
  assert.equal(createdTransactions[0].amount, 50000);

  service.clearAll();
});

void test('TransactionConfirmationService captures cliMsgId and exposes undoMessage helper', async () => {
  let _undonePayload: { chatId: string | number; msgId: string; cliMsgId?: string } | undefined;
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
    sendMessageWithResult: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve({
        success: true,
        msgId: 'bot-msg-888',
        cliMsgId: 'cli-msg-999',
      });
    },
    undoMessage: (chatId: string | number, msgId: string, cliMsgId?: string) => {
      _undonePayload = { chatId, msgId, cliMsgId };
      return Promise.resolve(true);
    },
  } as unknown as ZcaService;

  const mockFinanceService = {
    createTransaction: () => Promise.resolve({ id: 'tx_1' }),
  } as unknown as FinanceService;

  const service = new TransactionConfirmationService(
    mockZaloService,
    mockFinanceService,
    {} as unknown as RemindersService,
    {} as unknown as TasksService,
    {} as unknown as CalendarService,
    {} as unknown as UsersService,
    {} as unknown as GoogleAuthService,
  );

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 50000,
      category: 'Ăn uống',
      note: 'cơm trưa',
    },
  });

  assert.equal(pending.messageId, 'bot-msg-888');
  assert.equal(pending.cliMsgId, 'cli-msg-999');

  service.clearAll();
});

void test('TransactionConfirmationService recalls previous message when action is edited', async () => {
  let recalledMsgId: string | undefined;
  let recalledCliMsgId: string | undefined;

  const mockZaloService = {
    sendMessage: () => Promise.resolve(true),
    sendMessageWithResult: () =>
      Promise.resolve({
        success: true,
        msgId: 'msg-initial-123',
        cliMsgId: 'cli-initial-456',
      }),
    undoMessage: (_chatId: string | number, msgId: string, cliMsgId?: string) => {
      recalledMsgId = msgId;
      recalledCliMsgId = cliMsgId;
      return Promise.resolve(true);
    },
  } as unknown as ZcaService;

  const service = new TransactionConfirmationService(
    mockZaloService,
    {} as unknown as FinanceService,
  );

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 450000,
      category: 'Mua sắm',
      note: 'kính subin',
    },
  });

  let onEditCalled = false;
  await service.handleCommand('u1', 'c1', `edit ${pending.code} đổi thành 400k`, () => {
    onEditCalled = true;
    return Promise.resolve();
  });

  assert.equal(onEditCalled, true);
  assert.equal(recalledMsgId, 'msg-initial-123');
  assert.equal(recalledCliMsgId, 'cli-initial-456');

  service.clearAll();
});

void test('processConfirm recalls pending confirmation message and formats heart header when confirmed via reaction', async () => {
  let recalledMsgId: string | undefined;
  let recalledCliMsgId: string | undefined;
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
    sendMessageWithResult: () =>
      Promise.resolve({
        success: true,
        msgId: 'msg-card-777',
        cliMsgId: 'cli-card-777',
      }),
    undoMessage: (_chatId: string | number, msgId: string, cliMsgId?: string) => {
      recalledMsgId = msgId;
      recalledCliMsgId = cliMsgId;
      return Promise.resolve(true);
    },
  } as unknown as ZcaService;

  const mockFinanceService = {
    createTransaction: (dto: CreateFinanceTransactionDto) =>
      Promise.resolve({ id: 'tx_1', ...dto }),
  } as unknown as FinanceService;

  const service = new TransactionConfirmationService(mockZaloService, mockFinanceService);

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 450000,
      category: 'Mua sắm',
      note: 'mua tròng kính subin cho vợ',
      placeName: 'Mắt kính Subin Hồ Xuân Hương quận 3',
      paymentMethod: 'MoMo',
    },
  });

  // Reaction with heart
  const reactionResult = await service.handleReaction({
    chatId: 'c1',
    userId: 'u1',
    reactionIcon: '❤️',
    msgId: 'msg-card-777',
  });

  assert.equal(reactionResult.handled, true);
  assert.equal(reactionResult.status, 'confirmed');

  // Verify the card prompt message was recalled
  assert.equal(recalledMsgId, 'msg-card-777');
  assert.equal(recalledCliMsgId, 'cli-card-777');

  // Verify the single message sent has both heart celebration and DTO details
  // sentMessages[0] is the prompt, sentMessages[1] is the result
  const resultMessage = sentMessages[sentMessages.length - 1].text;
  assert.equal(
    resultMessage,
    `✅ [${pending.code}] Chi 450.000đ · Mua sắm · mua tròng kính subin cho vợ\n` +
      `Mắt kính Subin Hồ Xuân Hương quận 3 · MoMo`,
  );
  assert.doesNotMatch(resultMessage, /Đã nhận đủ|\(trống\)/);

  service.clearAll();
});

void test('handleTimeout recalls pending card message and sends only timeout notice', async () => {
  let recalledMsgId: string | undefined;
  let recalledCliMsgId: string | undefined;
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
    sendMessageWithResult: () =>
      Promise.resolve({
        success: true,
        msgId: 'msg-place-456',
        cliMsgId: 'cli-place-456',
      }),
    undoMessage: (_chatId: string | number, msgId: string, cliMsgId?: string) => {
      recalledMsgId = msgId;
      recalledCliMsgId = cliMsgId;
      return Promise.resolve(true);
    },
  } as unknown as ZcaService;

  const service = new TransactionConfirmationService(
    mockZaloService,
    {} as unknown as FinanceService,
  );
  service.timeoutMs = 50;

  await service.createPendingPlace({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      name: 'tiệm bánh tráng đầu đường gò xoài',
    },
  });

  await new Promise((r) => setTimeout(r, 80));

  assert.equal(recalledMsgId, 'msg-place-456');
  assert.equal(recalledCliMsgId, 'cli-place-456');
  const timeoutMsg = sentMessages[sentMessages.length - 1].text;
  assert.match(
    timeoutMsg,
    /^\[\d{3}\] Hết hạn, chưa lưu: tạo nơi chốn "tiệm bánh tráng đầu đường gò xoài"$/,
  );

  service.clearAll();
});

void test('processCancel recalls pending card message and sends cancellation notice', async () => {
  let recalledMsgId: string | undefined;
  let recalledCliMsgId: string | undefined;
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
    sendMessageWithResult: () =>
      Promise.resolve({
        success: true,
        msgId: 'msg-cancel-333',
        cliMsgId: 'cli-cancel-333',
      }),
    undoMessage: (_chatId: string | number, msgId: string, cliMsgId?: string) => {
      recalledMsgId = msgId;
      recalledCliMsgId = cliMsgId;
      return Promise.resolve(true);
    },
  } as unknown as ZcaService;

  const service = new TransactionConfirmationService(
    mockZaloService,
    {} as unknown as FinanceService,
  );

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 30000,
      category: 'Ăn uống',
      note: 'bánh tráng nướng',
    },
  });

  await service.handleCommand('u1', 'c1', `cancel ${pending.code}`);

  assert.equal(recalledMsgId, 'msg-cancel-333');
  assert.equal(recalledCliMsgId, 'cli-cancel-333');
  const cancelMsg = sentMessages[sentMessages.length - 1].text;
  assert.match(cancelMsg, /^\[\d{3}\] Đã huỷ: lưu khoản chi/);

  service.clearAll();
});

void test('Multi-card confirmation flow cleans up all temporary cards and interim messages, leaving only final message', async () => {
  const recalled: Array<{ chatId: string | number; msgId: string; cliMsgId?: string }> = [];
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];
  let msgSeq = 100;

  const mockRedisStorage = new Map<string, string>();
  const mockRedisService = {
    get: (key: string) => Promise.resolve(mockRedisStorage.get(key) || null),
    set: (key: string, val: string) => {
      mockRedisStorage.set(key, val);
      return Promise.resolve('OK');
    },
    del: (key: string) => {
      mockRedisStorage.delete(key);
      return Promise.resolve(1);
    },
  } as unknown as RedisService;

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
    sendMessageWithResult: (chatId: string | number, text: string) => {
      msgSeq++;
      const res = {
        success: true,
        msgId: `msg-${msgSeq}`,
        cliMsgId: `cli-${msgSeq}`,
      };
      sentMessages.push({ chatId, text });
      return Promise.resolve(res);
    },
    undoMessage: (chatId: string | number, msgId: string, cliMsgId?: string) => {
      recalled.push({ chatId, msgId, cliMsgId });
      return Promise.resolve(true);
    },
  } as unknown as ZcaService;

  const mockFinanceService = {
    resolveOrCreatePlace: (name: string) => Promise.resolve({ id: 'p1', name }),
    createTransaction: (dto: CreateFinanceTransactionDto) =>
      Promise.resolve({
        id: 'tx_1',
        amount: dto.amount,
        type: dto.type,
        category: dto.category,
        note: dto.note,
        occurredAt: new Date(),
      } as never),
  } as unknown as FinanceService;

  const service = new TransactionConfirmationService(
    mockZaloService,
    mockFinanceService,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    mockRedisService,
  );

  // 1. Create Place prompt card (e.g. "đối diện ctgroup")
  const placePending = await service.createPendingPlace({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      name: 'đối diện ctgroup',
    },
  });
  const placeMsgId = placePending.messageId;
  const placeCliId = placePending.cliMsgId;
  assert.ok(placeMsgId);

  // 2. Create Transaction prompt card (e.g. 20k ăn bánh mì ở đối diện ctgroup)
  const txPending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      type: 'expense',
      amount: 20000,
      category: 'Ăn uống',
      note: 'ăn bánh mì',
      placeName: 'đối diện ctgroup',
    },
  });
  const txMsgId = txPending.messageId;
  const txCliId = txPending.cliMsgId;
  assert.ok(txMsgId);

  // User confirms Place (650) via ❤️ reaction
  const res1 = await service.handleReaction({
    chatId: 'c1',
    userId: 'u1',
    reactionIcon: '/-heart',
    msgId: placeMsgId,
    cliMsgId: placeCliId,
  });
  assert.equal(res1.status, 'confirmed');

  // Place card should be recalled immediately
  assert.ok(recalled.some((m) => m.msgId === placeMsgId && m.cliMsgId === placeCliId));

  // No "you still have N pending" notice: the other card is still on screen.
  assert.ok(!sentMessages.some((m) => m.text.includes('Bạn còn')));

  // User confirms Expense (363) via ❤️ reaction
  const res2 = await service.handleReaction({
    chatId: 'c1',
    userId: 'u1',
    reactionIcon: '/-heart',
    msgId: txMsgId,
    cliMsgId: txCliId,
  });
  assert.equal(res2.status, 'confirmed');

  // Expense card should be recalled
  assert.ok(recalled.some((m) => m.msgId === txMsgId && m.cliMsgId === txCliId));

  // Both cards and the interim place confirmation were recalled.
  assert.ok(recalled.length >= 3);

  // The final message is the successful expense confirmation
  const finalMsg = sentMessages[sentMessages.length - 1].text;
  assert.match(finalMsg, /^✅ \[\d{3}\] Chi 20\.000đ/);
  assert.match(finalMsg, /đối diện ctgroup/);

  service.clearAll();
});

void test('TransactionConfirmationService keeps pending intact when canEdit rejects the sender', async () => {
  const { service, sentMessages } = createTestContext();

  const pending = await service.createPending({
    userId: 'owner-1',
    chatId: 'g1',
    payload: {
      type: 'expense',
      amount: 45000,
      category: 'Ăn uống',
      note: 'ăn trưa',
    },
  });
  const sentBefore = sentMessages.length;

  let onEditCalled = false;
  const handled = await service.handleCommand(
    'stranger-1',
    'g1',
    `edit ${pending.code} cho link drive`,
    () => {
      onEditCalled = true;
      return Promise.resolve();
    },
    () => Promise.resolve(false),
  );

  assert.equal(handled, true);
  assert.equal(onEditCalled, false);
  assert.equal(sentMessages.length, sentBefore, 'Rejected edit must stay silent');
  assert.ok(await service.getPendingByCode(pending.code), 'Pending must not be deleted');
});

void test('createPendingAction applies the saved requiredHearts of the chat thread', async () => {
  const threadConfigService = new ThreadConfigService();
  const groupId = `g-hearts-${Date.now()}`;
  await threadConfigService.updateConfig(
    groupId,
    { confirmationRules: { allowReactions: true, requiredHearts: 5, timeoutMinutes: 5 } },
    { threadType: 'group' },
  );
  const { service } = createTestContext(undefined, threadConfigService);
  const payload = {
    type: 'expense' as const,
    amount: 50000,
    category: 'Ăn uống',
    note: 'Ăn trưa',
  };

  const groupPending = await service.createPendingAction({
    userId: 'u1',
    chatId: groupId,
    actionType: 'RECORD_TRANSACTION',
    title: 'lưu khoản chi',
    payload,
    descriptor: FINANCE_TRANSACTION_DESCRIPTOR,
  });
  assert.equal(groupPending.requiredHearts, 5);

  // An explicit value still wins over the thread config.
  const explicitPending = await service.createPendingAction({
    userId: 'u1',
    chatId: groupId,
    actionType: 'RECORD_TRANSACTION',
    title: 'lưu khoản chi',
    payload,
    descriptor: FINANCE_TRANSACTION_DESCRIPTOR,
    requiredHearts: 2,
  });
  assert.equal(explicitPending.requiredHearts, 2);

  // A chat without a saved config (e.g. the official webhook bot) needs one heart and gets no config created.
  const unknownChat = `webhook-${Date.now()}`;
  const unknownPending = await service.createPendingAction({
    userId: 'u1',
    chatId: unknownChat,
    actionType: 'RECORD_TRANSACTION',
    title: 'lưu khoản chi',
    payload,
    descriptor: FINANCE_TRANSACTION_DESCRIPTOR,
  });
  assert.equal(unknownPending.requiredHearts, 1);
  assert.equal(await threadConfigService.findStoredConfig(unknownChat), undefined);

  service.clearAll();
});

void test('toValidRemindTimes keeps future times of the list, else of the single remindAt', () => {
  const now = new Date('2026-10-22T03:00:00.000Z');
  const iso = (times: Array<{ at: Date }>) => times.map((time) => time.at.toISOString());
  assert.deepEqual(
    iso(
      toValidRemindTimes(
        ['2026-10-22T05:00:00.000Z', '2026-10-22T02:59:00.000Z', 'not-a-date'],
        'ignored',
        now,
      ),
    ),
    ['2026-10-22T05:00:00.000Z'],
  );
  assert.deepEqual(iso(toValidRemindTimes(undefined, '2026-10-22T05:00:00.000Z', now)), [
    '2026-10-22T05:00:00.000Z',
  ]);
  assert.deepEqual(toValidRemindTimes(undefined, '2026-10-22T02:59:00.000Z', now), []);
  assert.deepEqual(toValidRemindTimes(undefined, undefined, now), []);
});

void test('parseReminderPayload keeps several times, past ones included', () => {
  const parsed = parseReminderPayload({
    userId: 'u1',
    title: 'Uống thuốc',
    remindTimes: ['2999-01-01T01:00:00.000Z', '2000-01-01T13:00:00.000Z', 'bogus'],
  });
  assert.deepEqual(
    parsed.remindTimes?.map((time) => (time instanceof Date ? time : time.at).toISOString()),
    ['2999-01-01T01:00:00.000Z', '2000-01-01T13:00:00.000Z'],
  );
  assert.throws(() => parseReminderPayload({ userId: 'u1', title: 'x', remindTimes: ['bogus'] }));
});

void test('parseReminderPayload keeps the repeat of each time and the remind-again rule', () => {
  const parsed = parseReminderPayload(
    JSON.parse(
      JSON.stringify({
        userId: 'u1',
        title: 'Uống thuốc',
        remindTimes: [
          { at: '2999-01-01T01:00:00.000Z', repeat: { repeatType: 'daily', repeatWeekdays: [] } },
          '2999-01-02T13:00:00.000Z',
        ],
        nagEveryMinutes: 15,
        nagCount: 3,
      }),
    ) as Record<string, unknown>,
  );
  assert.deepEqual(parsed.remindTimes, [
    {
      at: new Date('2999-01-01T01:00:00.000Z'),
      repeat: { repeatType: 'daily', repeatWeekdays: [] },
    },
    { at: new Date('2999-01-02T13:00:00.000Z') },
  ]);
  assert.equal(parsed.nagEveryMinutes, 15);
  assert.equal(parsed.nagCount, 3);
});

void test('a repeating time that passed while the card waited starts at its next occurrence', () => {
  // Approved on 20/10 09:05 (Vietnam time) for a yearly 20/10 08:00 and a one-off 09:00.
  const now = new Date('2026-10-20T09:05:00+07:00');
  const yearly = { repeatType: 'yearly', repeatWeekdays: [] as number[] };
  const payloadTimes = JSON.parse(
    JSON.stringify([
      { at: '2026-10-20T08:00:00+07:00', repeat: yearly },
      '2026-10-20T09:00:00+07:00',
    ]),
  ) as unknown;
  const nextYear = new Date('2027-10-20T08:00:00+07:00');
  // A task drops the past one-off time and keeps the yearly one, moved to next year.
  assert.deepEqual(toValidRemindTimes(payloadTimes, undefined, now), [
    { at: nextYear, repeat: yearly },
  ]);
  // A reminder still sends the past one-off time at once, but not the yearly one.
  const parsed = parseReminderPayload(
    { userId: 'u1', title: 'Mua hoa', remindTimes: payloadTimes },
    now,
  );
  assert.deepEqual(parsed.remindTimes, [
    { at: nextYear, repeat: yearly },
    { at: new Date('2026-10-20T09:00:00+07:00') },
  ]);
});

void test('TransactionConfirmationService cancel without a code sends no remaining-requests notice', async () => {
  const { service, sentMessages } = createTestContext();

  await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: { type: 'expense', amount: 10000, note: 'trà đá' },
  });
  const newest = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: { type: 'expense', amount: 20000, note: 'bánh mì' },
  });
  sentMessages.length = 0;

  await service.handleCommand('u1', 'c1', 'cancel');

  // The other card is still on screen, so only the cancel notice goes out.
  assert.deepEqual(
    sentMessages.map((m) => m.text),
    [`[${newest.code}] Đã huỷ: lưu khoản chi "bánh mì"`],
  );

  service.clearAll();
});

void test('describePendingAction names the action from its type and shortens long subjects', () => {
  const title = 'Đạt mua hoa tươi tặng Hằng nhân các dịp lễ 14/2, 8/3, 20/10 và sinh nhật của Hằng';
  assert.equal(
    describePendingAction({ actionType: 'CREATE_TASK', payload: { title } }),
    `thêm việc "${title.slice(0, 60).trimEnd()}…"`,
  );
  // Legacy action types from cards saved by older builds read the same.
  assert.equal(
    describePendingAction({ actionType: 'delete', payload: { type: 'income', note: 'thưởng' } }),
    'xoá khoản thu "thưởng"',
  );
  assert.equal(
    describePendingAction({ actionType: 'BAN_USER', payload: { targetUserId: 'u9' } }),
    'khoá tài khoản "u9"',
  );
  assert.equal(describePendingAction({ actionType: 'MANAGE_DEBT', payload: {} }), 'ghi công nợ');
});
