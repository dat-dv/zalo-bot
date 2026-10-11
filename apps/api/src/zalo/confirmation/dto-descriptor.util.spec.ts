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
import { CreateTaskOptions } from '../../google/google-tasks.service';
import { CreateEventOptions } from '../../google/google-calendar.service';

void test('DtoDescriptor strictly typechecks full DTO shape and displays (trống) for empty fields', () => {
  // Test 1: Finance Transaction with missing fields
  const txDto: CreateFinanceTransactionDto = {
    userId: 'u1',
    type: 'expense',
    amount: 15000,
    note: 'cà phê',
  };

  const txCard = renderDtoConfirmationCard(txDto, FINANCE_TRANSACTION_DESCRIPTOR);
  assert.match(txCard, /• Phân loại: 🔴 Khoản chi/);
  assert.match(txCard, /• Số tiền: 15\.000 đ/);
  assert.match(txCard, /• Danh mục: \(trống\)/);
  assert.match(txCard, /• Ghi chú: cà phê/);
  assert.match(txCard, /• Thời gian: \(trống\)/);
  assert.match(txCard, /• Địa điểm: \(trống\)/);
  assert.match(txCard, /• Phương thức: \(trống\)/);
  assert.match(txCard, /• Ảnh hóa đơn: \(trống\)/);
  // Hidden fields shouldn't be rendered
  assert.doesNotMatch(txCard, /Người dùng/);
  assert.doesNotMatch(txCard, /Địa điểm ID/);
});

void test('DEBT_DESCRIPTOR renders Vietnamese direction and empty fields appropriately', () => {
  const debtDto: CreateDebtDto = {
    userId: 'u1',
    direction: 'receivable',
    counterparty: 'Nam',
    amount: 500000,
  };

  const card = renderDtoConfirmationCard(debtDto, DEBT_DESCRIPTOR);
  assert.match(card, /• Phân loại: 👉 Họ nợ bạn \(Phải thu\)/);
  assert.match(card, /• Người liên quan: Nam/);
  assert.match(card, /• Tên gợi nhớ: \(trống\)/);
  assert.match(card, /• Số tiền: 500\.000 đ/);
  assert.match(card, /• Ghi chú: \(trống\)/);
  assert.match(card, /• Hạn trả: \(trống\)/);
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
  assert.match(card, /• Hình thức thông báo: 📞 Cuộc gọi/);
  assert.match(card, /• Lặp lại: Hàng ngày/);
});

void test('TASK_DESCRIPTOR renders Google Tasks fields with missing options', () => {
  const taskDto: CreateTaskOptions = {
    title: 'Dọn nhà đón Tết',
  };

  const card = renderDtoConfirmationCard(taskDto, TASK_DESCRIPTOR);
  assert.match(card, /• Việc cần làm: Dọn nhà đón Tết/);
  assert.match(card, /• Hạn chót: \(trống\)/);
  assert.match(card, /• Ghi chú: \(trống\)/);
  assert.doesNotMatch(card, /Danh sách việc/); // hidden
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
  assert.match(card, /• Địa điểm: \(trống\)/);
  assert.match(card, /• Mô tả: \(trống\)/);
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
  assert.match(card, /• Phân loại: 🔴 Khoản chi/);
  assert.match(card, /• Số tiền: 30\.000 đ/);
  assert.match(card, /• Danh mục: Ăn sáng/);
  assert.match(card, /• Ghi chú: bánh mì/);
  assert.match(card, /• Thời gian: \(trống\)/);
});

void test('COMPLETE_TASK_DESCRIPTOR renders task completion card with empty fallbacks', () => {
  const completeDto = {
    taskId: 'task_complete_123',
    taskTitle: 'Nộp báo cáo thuế',
  };

  const card = renderDtoConfirmationCard(completeDto, COMPLETE_TASK_DESCRIPTOR);
  assert.match(card, /• Việc cần làm: Nộp báo cáo thuế/);
  assert.match(card, /• Hạn chót: \(trống\)/);
  assert.match(card, /• Ghi chú: \(trống\)/);
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
  assert.match(card, /• Mô tả: \(trống\)/);
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

