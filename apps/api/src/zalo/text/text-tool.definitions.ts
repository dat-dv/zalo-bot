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
        occurredAt: {
          type: 'STRING',
          description:
            'Thời điểm phát sinh nợ dạng ISO 8601 (ví dụ: 2026-10-11T20:00:00+07:00). ' +
            'Nếu người dùng nêu rõ ngày giờ trong quá khứ/tương lai (hôm qua, tối 11/10...), hãy tính toán chính xác dựa trên giờ hiện tại.',
        },
        dueAt: {
          type: 'STRING',
          description:
            'Thời điểm hẹn trả nợ dạng ISO 8601 nếu người dùng có đề cập (ví dụ: mai trả, cuối tuần trả).',
        },
      },
      required: ['direction', 'counterparty', 'amount'],
    },
  },
  {
    name: TextToolType.RECORD_TRANSACTION,
    description:
      'Ghi nhận giao dịch thu chi tiền hàng ngày. ' +
      'Ví dụ: "ăn trưa 45k", "mua xăng 50k", "tiền lương 15tr", "được thưởng 500k", "tối qua cà phê 15k".',
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
          description: 'Chi tiết khoản tiền (ví dụ: ăn trưa, đổ xăng, uống cà phê)',
        },
        occurredAt: {
          type: 'STRING',
          description:
            'Thời điểm phát sinh giao dịch dạng ISO 8601 (ví dụ: 2026-10-11T20:00:00+07:00). ' +
            'Nếu người dùng nêu rõ ngày giờ (hôm qua, tối qua, ngày 11/10...), hãy tính toán chính xác dựa trên giờ hiện tại. ' +
            'Nếu không nêu thời gian, hãy bỏ qua.',
        },
        placeName: {
          type: 'STRING',
          description:
            'Địa điểm hoặc tên quán nếu có đề cập (ví dụ: Highlands Coffee, Circle K, chợ Bến Thành)',
        },
        paymentMethod: {
          type: 'STRING',
          description:
            'Phương thức thanh toán nếu có đề cập (ví dụ: tiền mặt, chuyển khoản, thẻ, ví MoMo)',
        },
        receiptUrl: {
          type: 'STRING',
          description: 'Đường dẫn ảnh hóa đơn chứng từ đính kèm (ví dụ: /api/receipts/...)',
        },
      },
      required: ['type', 'amount'],
    },
  },
  {
    name: TextToolType.DELETE_TRANSACTION,
    description:
      'Xóa một giao dịch thu chi (khoản thu, khoản chi) đã ghi nhận trước đó theo ID hoặc mô tả. ' +
      'Ví dụ: "Xóa Giao dịch thu–chi (finance_transactions) có ID: 88ca5db0-5e4a-4f10-af57-48fcb57e48b7", "xóa giao dịch id 88ca...", "xóa khoản chi ăn trưa 45k lúc nãy", "hủy giao dịch gần nhất".',
    parameters: {
      type: 'OBJECT',
      properties: {
        transactionId: {
          type: 'STRING',
          description: 'ID (UUID) của giao dịch cần xóa nếu người dùng cung cấp',
        },
        query: {
          type: 'STRING',
          description:
            'Mô tả, ghi chú hoặc từ khóa tìm kiếm giao dịch cần xóa (ví dụ: "ăn trưa", "gần nhất")',
        },
      },
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
  {
    name: TextToolType.CREATE_CALENDAR_EVENT,
    description:
      'Tạo sự kiện hoặc lịch hẹn mới trên Google Calendar. ' +
      'Ví dụ: "mai 14h họp dự án", "hẹn ăn tối thứ 6 lúc 19h tại Landmark 81".',
    parameters: {
      type: 'OBJECT',
      properties: {
        summary: {
          type: 'STRING',
          description: 'Tiêu đề cuộc hẹn / sự kiện',
        },
        startDateTime: {
          type: 'STRING',
          description: 'Thời gian bắt đầu dạng ISO 8601 (ví dụ: 2026-10-08T14:00:00+07:00)',
        },
        endDateTime: {
          type: 'STRING',
          description: 'Thời gian kết thúc dạng ISO 8601 (ví dụ: 2026-10-08T15:00:00+07:00)',
        },
        description: {
          type: 'STRING',
          description: 'Mô tả chi tiết nội dung sự kiện nếu có',
        },
        location: {
          type: 'STRING',
          description: 'Địa điểm diễn ra sự kiện nếu có',
        },
      },
      required: ['summary', 'startDateTime', 'endDateTime'],
    },
  },
  {
    name: TextToolType.LIST_CALENDAR_EVENTS,
    description:
      'Tra cứu danh sách lịch hẹn trên Google Calendar theo khoảng thời gian hoặc từ khóa. ' +
      'Ví dụ: "lịch hôm nay", "ngày mai có lịch gì không", "xem lịch tuần này", "tìm lịch họp".',
    parameters: {
      type: 'OBJECT',
      properties: {
        timeMin: {
          type: 'STRING',
          description: 'Thời gian bắt đầu tìm kiếm dạng ISO (mặc định là hiện tại)',
        },
        timeMax: {
          type: 'STRING',
          description: 'Thời gian kết thúc tìm kiếm dạng ISO',
        },
        query: {
          type: 'STRING',
          description: 'Từ khóa tìm kiếm tiêu đề sự kiện',
        },
      },
    },
  },
  {
    name: TextToolType.DELETE_CALENDAR_EVENT,
    description:
      'Xóa một sự kiện trên Google Calendar. ' +
      'Ví dụ: "xóa lịch họp dự án chiều nay", "hủy lịch ăn tối".',
    parameters: {
      type: 'OBJECT',
      properties: {
        eventId: {
          type: 'STRING',
          description: 'ID sự kiện cần xóa nếu biết',
        },
        query: {
          type: 'STRING',
          description: 'Tên hoặc từ khóa sự kiện cần xóa',
        },
      },
    },
  },
  {
    name: TextToolType.CREATE_TASK,
    description:
      'Thêm một việc cần làm mới vào Google Tasks (To-Do List). ' +
      'Ví dụ: "thêm việc nộp báo cáo trước 17h", "cần mua sữa chua", "nhắc làm slide".',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'Tiêu đề công việc cần làm',
        },
        due: {
          type: 'STRING',
          description: 'Hạn chót hoàn thành dạng RFC 3339 / ISO (ví dụ: 2026-10-08T17:00:00.000Z)',
        },
        notes: {
          type: 'STRING',
          description: 'Ghi chú thêm về công việc',
        },
      },
      required: ['title'],
    },
  },
  {
    name: TextToolType.LIST_TASKS,
    description:
      'Tra cứu danh sách việc cần làm (To-Do) từ Google Tasks. ' +
      'Ví dụ: "xem danh sách việc cần làm", "còn việc gì chưa làm", "danh sách task".',
    parameters: {
      type: 'OBJECT',
      properties: {
        showCompleted: {
          type: 'BOOLEAN',
          description:
            'true nếu muốn xem cả việc đã hoàn thành, false để chỉ xem việc chưa làm (mặc định false)',
        },
        maxResults: {
          type: 'NUMBER',
          description: 'Số lượng việc tối đa cần lấy (mặc định 20)',
        },
      },
    },
  },
  {
    name: TextToolType.COMPLETE_TASK,
    description:
      'Đánh dấu hoàn thành một công việc trong Google Tasks. ' +
      'Ví dụ: "đã xong việc nộp báo cáo", "hoàn thành task mua sữa".',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: {
          type: 'STRING',
          description: 'ID của công việc cần hoàn thành nếu biết',
        },
        taskTitle: {
          type: 'STRING',
          description: 'Tên của công việc cần hoàn thành',
        },
      },
    },
  },
  {
    name: TextToolType.LOGIN_GOOGLE,
    description:
      'Tạo đường dẫn đăng nhập kết nối tài khoản Google Workspace cá nhân (Calendar & Tasks). ' +
      'Ví dụ: "kết nối google", "đăng nhập google", "liên kết calendar", "đổi tài khoản gmail".',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: TextToolType.CREATE_PLACE,
    description:
      'Tạo hoặc ghi nhận một địa điểm, nơi chốn mới (quán ăn, cửa hàng, siêu thị, trung tâm thương mại...). ' +
      'Ví dụ: "tạo nơi chốn Aeon", "thêm địa điểm chợ Bến Thành", "lưu nơi chốn Highlands Coffee".',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: {
          type: 'STRING',
          description: 'Tên nơi chốn / địa điểm (ví dụ: Bến Thành, Aeon, Highlands Coffee)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: TextToolType.GET_STORAGE_LINKS,
    description:
      'Tra cứu đường dẫn (link) thư mục Google Drive và album Google Photos nơi bot lưu trữ hình ảnh, hóa đơn, video của người dùng. ' +
      'Ví dụ: "ảnh lưu ở đâu", "cho tôi link xem ảnh", "đường link vào folder", "link drive", "link album ảnh", ' +
      '"link hóa đơn", "hình ảnh lưu ở đâu", "link xem video", "đường dẫn kho lưu trữ", "xem folder ảnh", "thư mục hóa đơn ở đâu".',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: {
          type: 'STRING',
          enum: ['all', 'bill', 'image', 'video'],
          description:
            'Loại kho lưu trữ cần lấy link: bill (hóa đơn), image (hình ảnh), video, all (tất cả, mặc định).',
        },
      },
    },
  },
];
