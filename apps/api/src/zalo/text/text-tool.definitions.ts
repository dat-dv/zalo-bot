import { LlmToolDefinition } from '../../llm/types/llm.types';
import { TextToolType } from './text-tool.enum';

export const ZALO_TOOL_DEFINITIONS: LlmToolDefinition[] = [
  {
    name: TextToolType.MANAGE_DEBT,
    description:
      'Ghi nhận hoặc quản lý các khoản công nợ (cho vay, nợ người khác, mượn nợ). ' +
      'Ví dụ: "nợ a 100k", "cho Nam vay 200k", "Hùng mượn 500k", "mượn mẹ 2tr".',
    parameters: {
      type: 'OBJECT',
      properties: {
        direction: {
          type: 'STRING',
          enum: ['receivable', 'payable'],
          description:
            'receivable: người khác nợ người dùng (cho mượn); payable: người dùng nợ người khác (vay mượn, nợ tiền)',
        },
        counterparty: {
          type: 'STRING',
          description: 'Tên người liên quan (ví dụ: a, Nam, Hùng, mẹ)',
        },
        amount: {
          type: 'NUMBER',
          description: 'Số tiền bằng VND (ví dụ: 100k -> 100000, 2tr -> 2000000)',
        },
        note: {
          type: 'STRING',
          description: 'Ghi chú thêm về lý do nợ nếu có',
        },
      },
      required: ['direction', 'counterparty', 'amount'],
    },
  },
  {
    name: TextToolType.RECORD_TRANSACTION,
    description:
      'Ghi nhận giao dịch thu chi tiền hàng ngày. ' +
      'Ví dụ: "ăn trưa 45k", "mua xăng 50k", "tiền lương 15tr", "được thưởng 500k".',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: {
          type: 'STRING',
          enum: ['income', 'expense'],
          description: 'expense: khoản chi; income: khoản thu',
        },
        amount: {
          type: 'NUMBER',
          description: 'Số tiền bằng VND (ví dụ: 45k -> 45000, 15tr -> 15000000)',
        },
        category: {
          type: 'STRING',
          description: 'Danh mục phù hợp: Ăn uống, Đi lại, Mua sắm, Nhà cửa, Sức khỏe, Lương, Khác',
        },
        note: {
          type: 'STRING',
          description: 'Chi tiết khoản tiền (ví dụ: ăn trưa, đổ xăng)',
        },
      },
      required: ['type', 'amount'],
    },
  },
  {
    name: TextToolType.SET_REMINDER,
    description:
      'Đặt lịch hẹn hoặc lời nhắc công việc trong tương lai. ' +
      'Ví dụ: "mai 9h nhắc đi họp", "nhắc tôi 3h chiều đón con".',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'Nội dung cần nhắc nhở',
        },
        remindAt: {
          type: 'STRING',
          description: 'Thời điểm nhắc nhở dạng ISO string (ví dụ: 2026-10-08T09:00:00.000Z)',
        },
      },
      required: ['title', 'remindAt'],
    },
  },
  {
    name: TextToolType.GET_REPORT,
    description:
      'Tra cứu báo cáo, tóm tắt chi tiêu hoặc tình hình tài chính. ' +
      'Ví dụ: "hôm nay chi bao nhiêu?", "tháng này tiêu hết bao nhiêu?", "báo cáo tài chính".',
    parameters: {
      type: 'OBJECT',
      properties: {
        grain: {
          type: 'STRING',
          enum: ['day', 'month', 'year'],
          description: 'Khung thời gian báo cáo',
        },
      },
    },
  },
];
