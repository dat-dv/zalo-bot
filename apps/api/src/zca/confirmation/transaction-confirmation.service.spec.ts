import assert from 'node:assert/strict';
import test from 'node:test';
import { TransactionConfirmationService } from './transaction-confirmation.service';
import {
  FinanceService,
  CreateFinanceTransactionDto,
  CreateDebtDto,
} from '../../finance/finance.service';
import { RemindersService, CreateReminderDto } from '../../reminders/reminders.service';
import { GoogleTasksService, CreateTaskOptions } from '../../google/google-tasks.service';
import { GoogleCalendarService, CreateEventOptions } from '../../google/google-calendar.service';
import { UsersService } from '../../users/users.service';
import { GoogleAuthService } from '../../google/google-auth.service';
import { RedisService } from '../../redis/redis.service';
import { FINANCE_TRANSACTION_DESCRIPTOR } from './dto-descriptor.util';

interface TestContext {
  service: TransactionConfirmationService;
  sentMessages: Array<{ chatId: string | number; text: string }>;
  createdTransactions: CreateFinanceTransactionDto[];
  deletedTransactions: Array<{ userId: string | number; id: string }>;
  createdDebts: CreateDebtDto[];
  createdReminders: CreateReminderDto[];
  createdTasks: Array<CreateTaskOptions & { userId: string }>;
  completedTasks: Array<{ taskId: string; listId: string; userId: string }>;
  createdEvents: Array<CreateEventOptions & { userId: string }>;
  deletedCalendarEvents: Array<{ eventId: string; userId: string }>;
  bannedUsers: string[];
  revokedTokens: string[];
}

function createTestContext(): TestContext {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];
  const createdTransactions: CreateFinanceTransactionDto[] = [];
  const deletedTransactions: Array<{ userId: string | number; id: string }> = [];
  const createdDebts: CreateDebtDto[] = [];
  const createdReminders: CreateReminderDto[] = [];
  const createdTasks: Array<CreateTaskOptions & { userId: string }> = [];
  const completedTasks: Array<{ taskId: string; listId: string; userId: string }> = [];
  const createdEvents: Array<CreateEventOptions & { userId: string }> = [];
  const deletedCalendarEvents: Array<{ eventId: string; userId: string }> = [];
  const bannedUsers: string[] = [];
  const revokedTokens: string[] = [];

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
  } as unknown as ZaloService;

  const mockFinanceService = {
    createTransaction: (dto: CreateFinanceTransactionDto) => {
      createdTransactions.push(dto);
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
    deleteTransaction: (userId: string | number, id: string) => {
      deletedTransactions.push({ userId, id });
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

  const mockGoogleTasksService = {
    createTask: (options: CreateTaskOptions, userId: string) => {
      createdTasks.push({ ...options, userId });
      return Promise.resolve({
        id: 'task_1',
        title: options.title,
      } as never);
    },
    completeTask: (taskId: string, listId: string, userId: string) => {
      completedTasks.push({ taskId, listId, userId });
      return Promise.resolve(true);
    },
  } as unknown as GoogleTasksService;

  const mockGoogleCalendarService = {
    createEvent: (options: CreateEventOptions, userId: string) => {
      createdEvents.push({ ...options, userId });
      return Promise.resolve({
        id: 'event_1',
        summary: options.summary,
      } as never);
    },
    deleteEvent: (eventId: string, userId: string) => {
      deletedCalendarEvents.push({ eventId, userId });
      return Promise.resolve(true);
    },
  } as unknown as GoogleCalendarService;

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
    mockGoogleTasksService,
    mockGoogleCalendarService,
    mockUsersService,
    mockGoogleAuthService,
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

void test('TransactionConfirmationService notifies when timeout expires', async () => {
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
  assert.match(sentMessages[1].text, /Yêu cầu xóa/i);
  assert.match(sentMessages[1].text, /đã hết hạn 5 phút/);

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
  assert.match(sentMessages[0].text, /Xác nhận hoàn thành việc cần làm/i);
  assert.match(sentMessages[0].text, /Gửi email báo giá/);
  assert.match(sentMessages[0].text, /task_complete_999/);

  // Confirm
  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(completedTasks.length, 1);
  assert.equal(completedTasks[0].taskId, 'task_complete_999');
  assert.match(sentMessages[1].text, /ĐÃ XÁC NHẬN VÀ HOÀN THÀNH CÔNG VIỆC TRÊN GOOGLE TASKS/);

  service.clearAll();
});

void test('TransactionConfirmationService creates and confirms Google Calendar event deletion with strict shape', async () => {
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
  assert.match(sentMessages[0].text, /Xác nhận XÓA sự kiện Google Calendar/i);
  assert.match(sentMessages[0].text, /Họp giao ban sáng/);
  assert.match(sentMessages[0].text, /Phòng họp A/);

  // Confirm
  await service.handleCommand('u1', 'c1', `yes ${pending.code}`);
  assert.equal(deletedCalendarEvents.length, 1);
  assert.equal(deletedCalendarEvents[0].eventId, 'cal_event_del_123');
  assert.match(sentMessages[1].text, /ĐÃ XÁC NHẬN VÀ XÓA SỰ KIỆN GOOGLE CALENDAR THÀNH CÔNG/);

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
  assert.match(sentMessages[0].text, /Xác nhận KHÓA tài khoản người dùng/i);
  assert.match(sentMessages[0].text, /bad_user_456/);
  assert.match(sentMessages[0].text, /Hacker/);
  assert.match(sentMessages[0].text, /Spam hệ thống/);

  // Confirm
  await service.handleCommand('admin_1', 'c1', `yes ${pending.code}`);
  assert.equal(bannedUsers.length, 1);
  assert.equal(bannedUsers[0], 'bad_user_456');
  assert.equal(revokedTokens.length, 1);
  assert.equal(revokedTokens[0], 'bad_user_456');
  assert.match(sentMessages[1].text, /ĐÃ XÁC NHẬN VÀ KHÓA TÀI KHOẢN NGƯỜI DÙNG THÀNH CÔNG/);

  service.clearAll();
});

void test('TransactionConfirmationService edits transaction with "edit <mã> <nội dung>" and calls onEdit', async () => {
  const { service, sentMessages } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    rawPrompt: 'ăn trưa 45k',
    payload: {
      userId: 'u1',
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
      userId: 'u1',
      type: 'expense',
      amount: 45000,
      category: 'Ăn uống',
      note: 'ăn trưa',
    },
  });

  const handled = await service.handleCommand('u1', 'c1', `edit ${pending.code}`);
  assert.equal(handled, true);
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /Vui lòng cung cấp nội dung bạn muốn chỉnh sửa/);

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
      userId: 'u1',
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
      userId: 'u1',
      type: 'expense',
      amount: 45000,
      category: 'Ăn uống',
      note: 'ăn trưa',
    },
  });

  // Unauthorized user
  const handledOtherUser = await service.handleCommand('u2', 'c2', `edit ${pending.code} đổi 60k`);
  assert.equal(handledOtherUser, true);
  assert.match(sentMessages[1].text, /Bạn không có quyền chỉnh sửa yêu cầu/);

  // Wrong code
  const handledWrongCode = await service.handleCommand('u1', 'c1', 'edit 999 đổi 60k');
  assert.equal(handledWrongCode, true);
  assert.match(sentMessages[2].text, /Không tìm thấy yêu cầu chờ xác nhận với mã "999"/);

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
      userId: 'u1',
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
  assert.match(sentMessages[1].text, /Đã hủy/);

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
      userId: 'u1',
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
      userId: 'u1',
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
  assert.match(lastMsg.text, new RegExp(`chưa hỗ trợ tự động điều chỉnh.*${pending.code}`));

  service.clearAll();
});

void test('TransactionConfirmationService preserves pending action if onEdit throws an error', async () => {
  const { service, sentMessages } = createTestContext();

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
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
  assert.match(lastMsg.text, /Có lỗi xảy ra khi xử lý điều chỉnh yêu cầu.*AI parsing failed/);

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
  } as unknown as ZaloService;

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
    {} as unknown as GoogleTasksService,
    {} as unknown as GoogleCalendarService,
    {} as unknown as UsersService,
    {} as unknown as GoogleAuthService,
  );

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
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
  } as unknown as ZaloService;

  const mockFinanceService = {
    createTransaction: () => Promise.resolve({ id: 'tx_1' }),
  } as unknown as FinanceService;

  const service = new TransactionConfirmationService(
    mockZaloService,
    mockFinanceService,
    {} as unknown as RemindersService,
    {} as unknown as GoogleTasksService,
    {} as unknown as GoogleCalendarService,
    {} as unknown as UsersService,
    {} as unknown as GoogleAuthService,
  );

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
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
  } as unknown as ZaloService;

  const service = new TransactionConfirmationService(
    mockZaloService,
    {} as unknown as FinanceService,
  );

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
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
  } as unknown as ZaloService;

  const mockFinanceService = {
    createTransaction: (dto: CreateFinanceTransactionDto) =>
      Promise.resolve({ id: 'tx_1', ...dto }),
  } as unknown as FinanceService;

  const service = new TransactionConfirmationService(mockZaloService, mockFinanceService);

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
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
  assert.match(
    resultMessage,
    new RegExp(
      `🎉 Đã nhận đủ 1 lượt thả tim \\(❤️\\)! Yêu cầu \\[${pending.code}\\] đã được xác nhận thành công`,
    ),
  );
  assert.match(resultMessage, /• Phân loại:\s*🔴 Khoản chi/);
  assert.match(resultMessage, /• Số tiền:\s*450\.000 đ/);
  assert.match(resultMessage, /• Ghi chú:\s*mua tròng kính subin cho vợ/);
  assert.match(resultMessage, /• Địa điểm:\s*Mắt kính Subin Hồ Xuân Hương quận 3/);
  assert.match(resultMessage, /• Phương thức:\s*MoMo/);

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
  } as unknown as ZaloService;

  const service = new TransactionConfirmationService(
    mockZaloService,
    {} as unknown as FinanceService,
  );
  service.timeoutMs = 50;

  await service.createPendingPlace({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
      name: 'tiệm bánh tráng đầu đường gò xoài',
    },
  });

  await new Promise((r) => setTimeout(r, 80));

  assert.equal(recalledMsgId, 'msg-place-456');
  assert.equal(recalledCliMsgId, 'cli-place-456');
  const timeoutMsg = sentMessages[sentMessages.length - 1].text;
  assert.match(
    timeoutMsg,
    /⏰ Yêu cầu tạo nơi chốn "tiệm bánh tráng đầu đường gò xoài" \(mã: \d+\) đã hết hạn 5 phút và chưa được xác nhận\./,
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
  } as unknown as ZaloService;

  const service = new TransactionConfirmationService(
    mockZaloService,
    {} as unknown as FinanceService,
  );

  const pending = await service.createPending({
    userId: 'u1',
    chatId: 'c1',
    payload: {
      userId: 'u1',
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
  assert.match(cancelMsg, /❌ Đã hủy giao dịch khoản chi/);

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
  } as unknown as ZaloService;

  const mockFinanceService = {
    resolveOrCreatePlace: (_userId: string, name: string) => Promise.resolve({ id: 'p1', name }),
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
      userId: 'u1',
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
      userId: 'u1',
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

  // Intermediate notice "💡 Bạn còn 1 yêu cầu..." was sent
  const noticeMsg = sentMessages.find((m) => m.text.includes('Bạn còn 1 yêu cầu'));
  assert.ok(noticeMsg);

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

  // The intermediate notice ("Bạn còn 1 yêu cầu...") and interim place confirmation were recalled!
  assert.ok(recalled.length >= 3);

  // The final message is the successful expense confirmation
  const finalMsg = sentMessages[sentMessages.length - 1].text;
  assert.match(finalMsg, /Yêu cầu \[363\]|đã được xác nhận thành công!/);
  assert.match(finalMsg, /20\.000 đ/);
  assert.match(finalMsg, /đối diện ctgroup/);

  service.clearAll();
});
