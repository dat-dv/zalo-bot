import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderDtoConfirmationCard,
  FINANCE_TRANSACTION_DESCRIPTOR,
  DEBT_DESCRIPTOR,
  REMINDER_DESCRIPTOR,
  TASK_DESCRIPTOR,
  CALENDAR_EVENT_DESCRIPTOR,
  DELETE_TRANSACTION_DESCRIPTOR,
  COMPLETE_TASK_DESCRIPTOR,
  DELETE_CALENDAR_EVENT_DESCRIPTOR,
  BAN_USER_DESCRIPTOR,
} from './dto-descriptor.util';
import { CreateFinanceTransactionDto, CreateDebtDto } from '../../finance/finance.service';
import { CreateReminderDto } from '../../reminders/reminders.service';
import { CreateTaskOptions } from '../../tasks/task.types';
import { CreateEventOptions } from '../../google/google-calendar.service';

void test('DtoDescriptor strictly typechecks full DTO shape and drops empty fields', () => {
  // Test 1: Finance Transaction with missing fields
  const txDto: CreateFinanceTransactionDto = {
    type: 'expense',
    amount: 15000,
    note: 'cà phê',
  };

  const txCard = renderDtoConfirmationCard(txDto, FINANCE_TRANSACTION_DESCRIPTOR);
  // The card header already names the transaction type.
  assert.equal(txCard, '• Số tiền: 15.000 đ\n• Ghi chú: cà phê');
  assert.doesNotMatch(txCard, /\(trống\)/);
  // Hidden fields shouldn't be rendered
  assert.doesNotMatch(txCard, /Người dùng/);
  assert.doesNotMatch(txCard, /Địa điểm ID/);
});

void test('DEBT_DESCRIPTOR renders Vietnamese direction and drops empty fields', () => {
  const debtDto: CreateDebtDto = {
    direction: 'receivable',
    counterparty: 'Nam',
    amount: 500000,
  };

  const card = renderDtoConfirmationCard(debtDto, DEBT_DESCRIPTOR);
  assert.equal(
    card,
    '• Phân loại: Họ nợ bạn (phải thu)\n• Người liên quan: Nam\n• Số tiền: 500.000 đ',
  );
});

void test('REMINDER_DESCRIPTOR renders notifyType and repeatType correctly', () => {
  const reminderDto: CreateReminderDto = {
    userId: 'u1',
    title: 'Uống thuốc',
    remindAt: new Date('2026-10-12T08:00:00.000Z'),
    notifyType: 'call',
    repeatType: 'daily',
  };

  const card = renderDtoConfirmationCard(reminderDto, REMINDER_DESCRIPTOR);
  assert.match(card, /• Nội dung nhắc: Uống thuốc/);
  assert.match(card, /• Hình thức thông báo: Gọi điện/);
  // Each time shows its own repeat.
  assert.match(card, /• Thời gian nhắc: .*\(Hàng ngày\)/);
  assert.doesNotMatch(card, /• Lặp lại:/);
});

void test('TASK_DESCRIPTOR renders task fields with missing options', () => {
  const taskDto: CreateTaskOptions = {
    title: 'Dọn nhà đón Tết',
  };

  const card = renderDtoConfirmationCard(taskDto, TASK_DESCRIPTOR);
  // Empty due date and notes, no nag and the default "tag in group" mode take no line.
  assert.equal(card, '• Việc cần làm: Dọn nhà đón Tết\n• Nhắc ai: Không tag ai');
});

void test('Reminder cards show only the non-default delivery settings', () => {
  const defaults: CreateReminderDto = {
    userId: 'u1',
    title: 'Họp',
    remindAt: new Date('2026-10-12T08:00:00.000Z'),
    notifyType: 'text',
    chatId: 'u1',
    remindMode: 'mention',
  };
  const plain = renderDtoConfirmationCard(defaults, REMINDER_DESCRIPTOR);
  assert.doesNotMatch(plain, /Hình thức thông báo|Nhắc lại|Cách nhắc/);
  assert.match(plain, /• Gửi tới: Chat riêng của bạn/);

  const custom = renderDtoConfirmationCard(
    { ...defaults, chatId: 'group-1', remindMode: 'direct', nagEveryMinutes: 15, nagCount: 3 },
    REMINDER_DESCRIPTOR,
  );
  assert.match(custom, /• Nhắc lại: /);
  assert.match(custom, /• Gửi tới: Nhóm này/);
  assert.match(custom, /• Cách nhắc: Nhắn riêng từng người/);
});

void test('CALENDAR_EVENT_DESCRIPTOR renders Google Calendar event details with reminders', () => {
  const eventDto: CreateEventOptions = {
    summary: 'Họp ban quản trị',
    startDateTime: '2026-10-15T09:00:00+07:00',
    endDateTime: '2026-10-15T10:30:00+07:00',
    reminderMinutes: [60, 30, 10, 0],
  };

  const card = renderDtoConfirmationCard(eventDto, CALENDAR_EVENT_DESCRIPTOR);
  assert.match(card, /• Tiêu đề sự kiện: Họp ban quản trị/);
  assert.match(card, /• Bắt đầu:/);
  assert.match(card, /• Kết thúc:/);
  assert.doesNotMatch(card, /Địa điểm|Mô tả/);
  assert.match(card, /• Báo chuông trước: 60p, 30p, 10p, 0p/);
});

void test('DELETE_TRANSACTION_DESCRIPTOR displays target transaction ID and details', () => {
  const delDto = {
    transactionId: 'uuid-1234-abcd',
    type: 'expense' as const,
    amount: 30000,
    category: 'Ăn sáng',
    note: 'bánh mì',
  };

  const card = renderDtoConfirmationCard(delDto, DELETE_TRANSACTION_DESCRIPTOR);
  assert.match(card, /• Mã giao dịch: uuid-1234-abcd/);
  assert.doesNotMatch(card, /Phân loại|Thời gian/);
  assert.match(card, /• Số tiền: 30\.000 đ/);
  assert.match(card, /• Danh mục: Ăn sáng/);
  assert.match(card, /• Ghi chú: bánh mì/);
});

void test('COMPLETE_TASK_DESCRIPTOR renders task completion card without empty fields', () => {
  const completeDto = {
    taskId: 'task_complete_123',
    taskTitle: 'Nộp báo cáo thuế',
  };

  const card = renderDtoConfirmationCard(completeDto, COMPLETE_TASK_DESCRIPTOR);
  assert.match(card, /• Việc cần làm: Nộp báo cáo thuế/);
  assert.doesNotMatch(card, /Hạn chót|Ghi chú/);
  assert.match(card, /• Mã công việc \(ID\): task_complete_123/);
});

void test('DELETE_CALENDAR_EVENT_DESCRIPTOR renders event details for deletion', () => {
  const delEventDto = {
    eventId: 'event_del_456',
    summary: 'Hẹn cà phê cuối tuần',
    startDateTime: '2026-10-18T09:00:00+07:00',
    endDateTime: '2026-10-18T10:30:00+07:00',
    location: 'Highlands Coffee',
  };

  const card = renderDtoConfirmationCard(delEventDto, DELETE_CALENDAR_EVENT_DESCRIPTOR);
  assert.match(card, /• Tiêu đề sự kiện: Hẹn cà phê cuối tuần/);
  assert.match(card, /• Bắt đầu:/);
  assert.match(card, /• Kết thúc:/);
  assert.match(card, /• Địa điểm: Highlands Coffee/);
  assert.doesNotMatch(card, /Mô tả/);
  assert.match(card, /• Mã sự kiện \(ID\): event_del_456/);
});

void test('BAN_USER_DESCRIPTOR renders user ban confirmation details', () => {
  const banDto = {
    targetUserId: 'user_ban_789',
    targetName: 'Nguyễn Văn A',
    role: 'user',
    reason: 'Spam liên tục',
  };

  const card = renderDtoConfirmationCard(banDto, BAN_USER_DESCRIPTOR);
  assert.match(card, /• Mã người dùng \(ID\): user_ban_789/);
  assert.match(card, /• Tên người dùng: Nguyễn Văn A/);
  assert.match(card, /• Vai trò hiện tại: Người dùng/);
  assert.match(card, /• Lý do khóa: Spam liên tục/);
});
