import { CreateFinanceTransactionDto, CreateDebtDto } from '../../finance/finance.service';
import { CreateReminderDto } from '../../reminders/reminders.service';
import { CreateTaskOptions } from '../../google/google-tasks.service';
import { CreateEventOptions } from '../../google/google-calendar.service';

/**
 * Định nghĩa cấu hình hiển thị và định dạng cho từng trường của DTO.
 */
export interface DtoFieldConfig<T, K extends keyof T> {
  /** Nhãn tiếng Việt hiển thị trên thẻ xác nhận (vd: "Số tiền", "Ghi chú") */
  label: string;
  /** Thứ tự xuất hiện trong thẻ xác nhận (số nhỏ hơn đứng trước) */
  order?: number;
  /**
   * Nếu true, trường này sẽ ẩn khỏi thẻ xác nhận hiển thị cho người dùng
   * (phù hợp với các internal id như userId, taskListId, contactId, v.v.).
   */
  hidden?: boolean;
  /**
   * Tùy biến format giá trị sang tiếng Việt.
   * Nếu trả về rỗng, null hoặc undefined, hệ thống sẽ tự động hiển thị "(trống)".
   */
  format?: (value: T[K], dto: T) => string | undefined | null;
}

/**
 * STRICT TYPE MAPPING TỪ DTO:
 * - [K in keyof T]-? bắt buộc mọi thuộc tính K trong T PHẢI được định nghĩa trong Descriptor.
 * - Nếu DTO thêm trường, đổi tên trường hoặc xóa trường, TypeScript compiler sẽ lập tức báo lỗi tại compile time!
 */
export type DtoDescriptor<T> = {
  [K in keyof T]-?: DtoFieldConfig<T, K>;
};

/**
 * Format ngày giờ theo định dạng tiếng Việt (Asia/Ho_Chi_Minh).
 */
export function formatDateTimeVN(value?: string | Date | null): string {
  if (!value) return '(trống)';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '(trống)';
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format số tiền kèm đơn vị tiền tệ VND/ngoại tệ.
 */
export function formatCurrencyVN(amount?: number | null, currency?: string): string {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    return '(trống)';
  }
  const cur = currency === 'VND' || !currency ? 'đ' : currency;
  return `${Number(amount).toLocaleString('vi-VN')} ${cur}`;
}

/**
 * Strict Descriptor cho CreateFinanceTransactionDto.
 * Mọi field thay đổi trong CreateFinanceTransactionDto sẽ được TypeScript typecheck kiểm tra chặt chẽ.
 */
export const FINANCE_TRANSACTION_DESCRIPTOR: DtoDescriptor<CreateFinanceTransactionDto> = {
  type: {
    label: 'Phân loại',
    order: 1,
    format: (v) => (v === 'income' ? '🟢 Khoản thu' : '🔴 Khoản chi'),
  },
  amount: {
    label: 'Số tiền',
    order: 2,
    format: (v, dto) => formatCurrencyVN(v, dto.currency),
  },
  currency: { label: 'Đơn vị tiền tệ', hidden: true },
  category: {
    label: 'Danh mục',
    order: 3,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  note: {
    label: 'Ghi chú',
    order: 4,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  occurredAt: {
    label: 'Thời gian',
    order: 5,
    format: (v) => formatDateTimeVN(v),
  },
  placeName: {
    label: 'Địa điểm',
    order: 6,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  paymentMethod: {
    label: 'Phương thức',
    order: 7,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  receiptUrl: {
    label: 'Ảnh hóa đơn',
    order: 8,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  contactId: { label: 'Người liên hệ ID', hidden: true },
  placeId: { label: 'Địa điểm ID', hidden: true },
  createNewPlace: { label: 'Tạo địa điểm mới', hidden: true },
  createdByUserId: { label: 'Người tạo ID', hidden: true },
  createdByName: { label: 'Người tạo', hidden: true },
  source: { label: 'Nguồn', hidden: true },
  sourceChatId: { label: 'Kênh nguồn', hidden: true },
};

/**
 * DTO đại diện cho hành động xóa giao dịch.
 */
export interface DeleteTransactionDto {
  transactionId: string;
  type: 'income' | 'expense';
  amount: number;
  currency?: string;
  category?: string;
  note?: string;
  occurredAt?: string;
}

/**
 * Strict Descriptor cho DeleteTransactionDto.
 */
export const DELETE_TRANSACTION_DESCRIPTOR: DtoDescriptor<DeleteTransactionDto> = {
  transactionId: { label: 'Mã giao dịch', hidden: false, order: 6 },
  type: {
    label: 'Phân loại',
    order: 1,
    format: (v) => (v === 'income' ? '🟢 Khoản thu' : '🔴 Khoản chi'),
  },
  amount: {
    label: 'Số tiền',
    order: 2,
    format: (v, dto) => formatCurrencyVN(v, dto.currency),
  },
  currency: { label: 'Đơn vị tiền tệ', hidden: true },
  category: {
    label: 'Danh mục',
    order: 3,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  note: {
    label: 'Ghi chú',
    order: 4,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  occurredAt: {
    label: 'Thời gian',
    order: 5,
    format: (v) => formatDateTimeVN(v),
  },
};

/**
 * Strict Descriptor cho CreateDebtDto (Quản lý công nợ).
 */
export const DEBT_DESCRIPTOR: DtoDescriptor<CreateDebtDto> = {
  direction: {
    label: 'Phân loại',
    order: 1,
    format: (v) => (v === 'receivable' ? '👉 Họ nợ bạn (Phải thu)' : '👈 Bạn nợ họ (Phải trả)'),
  },
  counterparty: {
    label: 'Người liên quan',
    order: 2,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  counterpartyAlias: {
    label: 'Tên gợi nhớ',
    order: 3,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  amount: {
    label: 'Số tiền',
    order: 4,
    format: (v, dto) => formatCurrencyVN(v, dto.currency),
  },
  currency: { label: 'Đơn vị tiền tệ', hidden: true },
  note: {
    label: 'Ghi chú',
    order: 5,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  occurredAt: {
    label: 'Thời gian ghi nhận',
    order: 6,
    format: (v) => formatDateTimeVN(v),
  },
  dueAt: {
    label: 'Hạn trả',
    order: 7,
    format: (v) => formatDateTimeVN(v),
  },
  contactId: { label: 'Liên hệ ID', hidden: true },
  createNewContact: { label: 'Tạo liên hệ mới', hidden: true },
};

/**
 * Strict Descriptor cho CreateReminderDto (Nhắc nhở công việc).
 */
export const REMINDER_DESCRIPTOR: DtoDescriptor<CreateReminderDto> = {
  userId: { label: 'Người dùng', hidden: true },
  title: {
    label: 'Nội dung nhắc',
    order: 1,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  remindAt: {
    label: 'Thời gian nhắc',
    order: 2,
    format: (v) => formatDateTimeVN(v),
  },
  notifyType: {
    label: 'Hình thức thông báo',
    order: 3,
    format: (v) => (v === 'call' ? '📞 Cuộc gọi' : '💬 Tin nhắn'),
  },
  repeatType: {
    label: 'Lặp lại',
    order: 4,
    format: (v) => (v === 'daily' ? 'Hàng ngày' : v === 'weekly' ? 'Hàng tuần' : 'Không lặp'),
  },
  status: { label: 'Trạng thái', hidden: true },
};

/**
 * Strict Descriptor cho CreateTaskOptions (việc cần làm).
 */
export const TASK_DESCRIPTOR: DtoDescriptor<CreateTaskOptions> = {
  title: {
    label: 'Việc cần làm',
    order: 1,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  due: {
    label: 'Hạn chót',
    order: 2,
    format: (v) => formatDateTimeVN(v),
  },
  notes: {
    label: 'Ghi chú',
    order: 3,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  taskListId: { label: 'Danh sách việc', hidden: true },
};

/**
 * Strict Descriptor cho CreateEventOptions (Google Calendar).
 */
export const CALENDAR_EVENT_DESCRIPTOR: DtoDescriptor<CreateEventOptions> = {
  summary: {
    label: 'Tiêu đề sự kiện',
    order: 1,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  startDateTime: {
    label: 'Bắt đầu',
    order: 2,
    format: (v) => formatDateTimeVN(v),
  },
  endDateTime: {
    label: 'Kết thúc',
    order: 3,
    format: (v) => formatDateTimeVN(v),
  },
  location: {
    label: 'Địa điểm',
    order: 4,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  description: {
    label: 'Mô tả',
    order: 5,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  reminderMinutes: {
    label: 'Báo chuông trước',
    order: 6,
    format: (v) =>
      Array.isArray(v) && v.length > 0 ? v.map((m) => `${m}p`).join(', ') : '(trống)',
  },
  timeZone: { label: 'Múi giờ', hidden: true },
};

/**
 * DTO đại diện cho việc hoàn thành một việc cần làm (`taskId` là id trong DB, hoặc id Google cũ).
 */
export interface CompleteTaskDto {
  taskId: string;
  taskTitle: string;
  notes?: string;
  due?: string;
}

/**
 * Strict Descriptor cho CompleteTaskDto.
 */
export const COMPLETE_TASK_DESCRIPTOR: DtoDescriptor<CompleteTaskDto> = {
  taskTitle: {
    label: 'Việc cần làm',
    order: 1,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  due: {
    label: 'Hạn chót',
    order: 2,
    format: (v) => formatDateTimeVN(v),
  },
  notes: {
    label: 'Ghi chú',
    order: 3,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  taskId: {
    label: 'Mã công việc (ID)',
    order: 4,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
};

/**
 * DTO đại diện cho việc xóa sự kiện Google Calendar.
 */
export interface DeleteCalendarEventDto {
  eventId: string;
  summary: string;
  startDateTime?: string;
  endDateTime?: string;
  location?: string;
  description?: string;
}

/**
 * Strict Descriptor cho DeleteCalendarEventDto.
 */
export const DELETE_CALENDAR_EVENT_DESCRIPTOR: DtoDescriptor<DeleteCalendarEventDto> = {
  summary: {
    label: 'Tiêu đề sự kiện',
    order: 1,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  startDateTime: {
    label: 'Bắt đầu',
    order: 2,
    format: (v) => formatDateTimeVN(v),
  },
  endDateTime: {
    label: 'Kết thúc',
    order: 3,
    format: (v) => formatDateTimeVN(v),
  },
  location: {
    label: 'Địa điểm',
    order: 4,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  description: {
    label: 'Mô tả',
    order: 5,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  eventId: {
    label: 'Mã sự kiện (ID)',
    order: 6,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
};

/**
 * DTO đại diện cho việc khóa tài khoản người dùng (Admin).
 */
export interface BanUserDto {
  targetUserId: string;
  targetName?: string;
  role?: string;
  reason?: string;
}

/**
 * Strict Descriptor cho BanUserDto.
 */
export const BAN_USER_DESCRIPTOR: DtoDescriptor<BanUserDto> = {
  targetUserId: {
    label: 'Mã người dùng (ID)',
    order: 1,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  targetName: {
    label: 'Tên người dùng',
    order: 2,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
  role: {
    label: 'Vai trò hiện tại',
    order: 3,
    format: (v) => (v === 'admin' ? 'Quản trị viên' : 'Người dùng'),
  },
  reason: {
    label: 'Lý do khóa',
    order: 4,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
};

/**
 * DTO đại diện cho việc tạo mới nơi chốn (FinancePlace).
 */
export interface CreatePlaceDto {
  name: string;
}

/**
 * Strict Descriptor cho CreatePlaceDto.
 */
export const PLACE_DESCRIPTOR: DtoDescriptor<CreatePlaceDto> = {
  name: {
    label: 'Tên nơi chốn / địa điểm',
    order: 1,
    format: (v) => (typeof v === 'string' && v.trim() ? v.trim() : '(trống)'),
  },
};

/**
 * Render thẻ xác nhận dựa trên DTO và Descriptor tương ứng.
 * Mọi field hiển thị nếu không có giá trị sẽ tự động điền "(trống)".
 */
export function renderDtoConfirmationCard<T extends object>(
  dto: T,
  descriptor: DtoDescriptor<T>,
): string {
  const allKeys = Object.keys(descriptor) as Array<keyof T>;
  const visibleKeys = allKeys.filter((key) => !descriptor[key]?.hidden);

  visibleKeys.sort((a, b) => {
    const orderA = descriptor[a]?.order ?? 999;
    const orderB = descriptor[b]?.order ?? 999;
    return orderA - orderB;
  });

  const lines: string[] = [];

  for (const key of visibleKeys) {
    const config = descriptor[key];
    const val = dto[key];

    let formatted: string | undefined | null;

    if (config.format) {
      formatted = config.format(val, dto);
    } else {
      if (val === undefined || val === null || val === '') {
        formatted = '(trống)';
      } else if (val instanceof Date) {
        formatted = formatDateTimeVN(val);
      } else if (typeof val === 'number') {
        formatted = Number.isNaN(val) ? '(trống)' : val.toLocaleString('vi-VN');
      } else if (typeof val === 'boolean') {
        formatted = val ? 'Có' : 'Không';
      } else if (typeof val === 'string') {
        const str = val.trim();
        formatted = str || '(trống)';
      } else {
        formatted = JSON.stringify(val);
      }
    }

    if (!formatted || !formatted.trim()) {
      formatted = '(trống)';
    }

    lines.push(`• ${config.label}: ${formatted}`);
  }

  return lines.join('\n');
}
