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
        counterpartyAlias: {
          type: 'STRING',
          description:
            'Biệt danh để phân biệt người trùng tên, chỉ khi người dùng nêu rõ (ví dụ: "Trí Đen" trong "Trí (Trí Đen)")',
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
      'Đặt lịch hẹn hoặc lời nhắc cá nhân trong tương lai (không thêm vào danh sách việc). ' +
      'Ví dụ: "mai 9h nhắc đi họp", "nhắc tôi 3h chiều đón con", "mỗi dịp 14/2 nhắc mua hoa". ' +
      'Nếu người dùng thêm một việc cần làm và muốn được nhắc, dùng CREATE_TASK kèm remindAt. ' +
      'Dịp lặp hằng năm (14/2, 8/3, 20/10, sinh nhật, kỷ niệm) dùng tool này với repeatingTimes ' +
      'yearly, trừ khi người dùng nói rõ là thêm việc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'Nội dung cần nhắc nhở',
        },
        remindAt: {
          type: 'STRING',
          description:
            'Thời điểm nhắc nhở dạng ISO string (ví dụ: 2026-10-08T09:00:00.000Z); nếu nhắc nhiều lần thì là lần đầu.',
        },
        remindTimes: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description:
            'Khi người dùng muốn nhắc nhiều lần ("8h và 20h", "sáng và chiều mai"): mọi thời điểm dạng ISO, tối đa 10.',
        },
        repeatingTimes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              at: {
                type: 'STRING',
                description:
                  'Lần gần nhất TRONG TƯƠNG LAI của giờ lặp, dạng ISO (dịp hằng năm đã qua ' +
                  'trong năm nay thì là năm sau).',
              },
              repeatType: {
                type: 'STRING',
                enum: ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'],
                description:
                  'daily = hằng ngày; weekdays = thứ 2 đến thứ 6; weekly = hằng tuần; ' +
                  'monthly = hằng tháng (cùng ngày trong tháng); yearly = hằng năm (cùng ngày ' +
                  'và tháng: ngày lễ 14/2, 8/3, 20/10, sinh nhật, ngày kỷ niệm). Dịp hằng năm ' +
                  'KHÔNG dùng monthly.',
              },
              repeatWeekdays: {
                type: 'ARRAY',
                items: { type: 'NUMBER' },
                description:
                  'Chỉ với weekly: các thứ trong tuần, 0 = Chủ nhật, 1 = thứ 2 … 6 = thứ 7. ' +
                  'Bỏ trống thì lặp đúng thứ của at.',
              },
            },
            required: ['at', 'repeatType'],
          },
          description:
            'Các giờ nhắc có lặp lại, mỗi giờ một kiểu lặp riêng ("8h hằng ngày", "7h thứ 3 và ' +
            'thứ 5 hằng tuần", "ngày 5 hằng tháng", "mỗi dịp 14/2 hằng năm"). Giờ chỉ nhắc một ' +
            'lần thì để ở remindTimes / remindAt, không lặp lại ở đây.',
        },
        nagEveryMinutes: {
          type: 'NUMBER',
          description:
            'Khi người dùng muốn nhắc đi nhắc lại sau mỗi lần nhắc ("nhắc lại mỗi 15 phút"): ' +
            'số phút giữa hai lần, 5 đến 1440. Đi cùng nagCount.',
        },
        nagCount: {
          type: 'NUMBER',
          description: 'Số lần nhắc lại tối đa sau mỗi lần nhắc, 1 đến 10 ("3 lần").',
        },
        remindInGroup: {
          type: 'BOOLEAN',
          description:
            'true khi muốn nhắc trong nhóm đang nhắn ("nhắc cả nhóm"). Mặc định bot nhắn riêng cho ' +
            'người nhắn; tin có tag @ ai đó thì tự nhắc trong nhóm và tag người đó. Nhắc trong ' +
            'nhóm mà không tag ai thì bot tag chính người nhắn.',
        },
        remindSelf: {
          type: 'BOOLEAN',
          description:
            'true khi nhắc trong nhóm mà người nhắn cũng muốn được tag ("nhắc tôi và @Trí").',
        },
        remindMode: {
          type: 'STRING',
          enum: ['mention', 'direct'],
          description:
            'direct khi muốn nhắn riêng / inbox cho từng người được tag; mặc định mention (tag trong nhóm).',
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
      'Thêm một việc cần làm mới vào danh sách việc chung của zalobot, có thể kèm giờ nhắc. ' +
      'Ví dụ: "thêm việc nộp báo cáo trước 17h", "cần mua sữa chua", ' +
      '"thêm việc làm slide, 3h chiều mai nhắc tôi".',
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
        remindAt: {
          type: 'STRING',
          description:
            'Thời điểm bot nhắc việc này trong cuộc trò chuyện, dạng ISO (ví dụ: 2026-10-08T08:00:00.000Z). ' +
            'Chỉ điền khi người dùng muốn được nhắc.',
        },
        remindTimes: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description:
            'Khi muốn nhắc việc này nhiều lần ("nhắc 8h và 14h mai"): mọi thời điểm dạng ISO, tối đa 10.',
        },
        repeatingTimes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              at: {
                type: 'STRING',
                description:
                  'Lần gần nhất TRONG TƯƠNG LAI của giờ lặp, dạng ISO (dịp hằng năm đã qua ' +
                  'trong năm nay thì là năm sau).',
              },
              repeatType: {
                type: 'STRING',
                enum: ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'],
                description:
                  'daily = hằng ngày; weekdays = thứ 2 đến thứ 6; weekly = hằng tuần; ' +
                  'monthly = hằng tháng (cùng ngày trong tháng); yearly = hằng năm (cùng ngày ' +
                  'và tháng: ngày lễ 14/2, 8/3, 20/10, sinh nhật, ngày kỷ niệm). Dịp hằng năm ' +
                  'KHÔNG dùng monthly.',
              },
              repeatWeekdays: {
                type: 'ARRAY',
                items: { type: 'NUMBER' },
                description:
                  'Chỉ với weekly: các thứ trong tuần, 0 = Chủ nhật, 1 = thứ 2 … 6 = thứ 7. ' +
                  'Bỏ trống thì lặp đúng thứ của at.',
              },
            },
            required: ['at', 'repeatType'],
          },
          description:
            'Các giờ nhắc có lặp lại, mỗi giờ một kiểu lặp riêng ("8h hằng ngày", "7h thứ 3 và ' +
            'thứ 5 hằng tuần", "ngày 5 hằng tháng", "mỗi dịp 14/2 hằng năm"). Giờ chỉ nhắc một ' +
            'lần thì để ở remindTimes / remindAt, không lặp lại ở đây.',
        },
        nagEveryMinutes: {
          type: 'NUMBER',
          description:
            'Khi người dùng muốn nhắc đi nhắc lại sau mỗi lần nhắc ("nhắc lại mỗi 15 phút"): ' +
            'số phút giữa hai lần, 5 đến 1440. Đi cùng nagCount.',
        },
        nagCount: {
          type: 'NUMBER',
          description: 'Số lần nhắc lại tối đa sau mỗi lần nhắc, 1 đến 10 ("3 lần").',
        },
        remindSelf: {
          type: 'BOOLEAN',
          description:
            'true khi người nhắn muốn chính họ được nhắc ("nhắc tôi"). Người được tag @ trong tin ' +
            'tự động được nhắc, không cần ghi tên ở đây.',
        },
        remindMode: {
          type: 'STRING',
          enum: ['mention', 'direct'],
          description:
            'direct khi người dùng muốn nhắn riêng / inbox cho người được nhắc; mặc định mention ' +
            '(tag họ trong nhóm).',
        },
      },
      required: ['title'],
    },
  },
  {
    name: TextToolType.LIST_TASKS,
    description:
      'Tra cứu danh sách việc cần làm (To-Do) chung của hệ thống. ' +
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
      'Đánh dấu hoàn thành một việc trong danh sách việc cần làm. ' +
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
      'CHỈ dùng khi người dùng nói rõ muốn đăng nhập, kết nối, liên kết tài khoản Google hoặc đổi tài khoản Gmail. ' +
      'Ví dụ: "kết nối google", "đăng nhập google", "liên kết calendar", "đổi tài khoản gmail". ' +
      'KHÔNG dùng tool này khi người dùng hỏi về đường dẫn, link xem ảnh, link folder, hay kho lưu trữ.',
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
  {
    name: TextToolType.SEARCH_CHAT_HISTORY,
    description:
      'Tìm lại nội dung đã trò chuyện trong cuộc chat Zalo hiện tại để trả lời câu hỏi về quá khứ: ' +
      'đã đi đâu, đã nói gì, ai đã gửi gì, đã hẹn gì, đã quyết định gì. ' +
      'Ví dụ: "năm ngoái mình đi đâu", "hôm trước Nam nói gửi file gì", "tháng 5 nhóm hẹn ăn ở đâu", ' +
      '"tuần trước ai bảo mua vé", "lần trước mình bàn gì về chuyến Đà Lạt".',
    parameters: {
      type: 'OBJECT',
      properties: {
        keywords: {
          type: 'STRING',
          description:
            'Từ khóa và từ đồng nghĩa có thể đã xuất hiện trong tin nhắn, phân cách bằng dấu phẩy. ' +
            'Ví dụ hỏi "đi đâu": "đi, du lịch, đi chơi, chuyến, vé, khách sạn, homestay, máy bay, xe khách".',
        },
        fromDate: {
          type: 'STRING',
          description:
            'Ngày bắt đầu (YYYY-MM-DD, giờ Việt Nam) nếu câu hỏi có mốc thời gian. "năm ngoái" -> ngày 01/01 của năm trước.',
        },
        toDate: {
          type: 'STRING',
          description:
            'Ngày kết thúc, tính cả ngày đó (YYYY-MM-DD). "năm ngoái" -> ngày 31/12 của năm trước.',
        },
        question: {
          type: 'STRING',
          description: 'Câu hỏi gốc của người dùng.',
        },
      },
      required: ['keywords'],
    },
  },
  {
    name: TextToolType.REMEMBER_NOTE,
    description:
      'Ghi nhớ lâu dài một điều người dùng DẶN bot cho cuộc chat này: tính cách, cách xưng hô, ' +
      'tên gọi của bot, quy ước của nhóm, thông tin cố định cần luôn nhớ. Gọi khi người dùng nói ' +
      '"nhớ nhé", "nhớ là", "tao dặn", "từ giờ mày là / hãy...", "lần sau nhớ...". ' +
      'Ví dụ: "tao dặn rồi mày là con mèo đen 2 mái", "từ giờ xưng em gọi anh", "nhớ là Hằng ăn chay". ' +
      'Không dùng cho việc cần làm, lời nhắc hay câu đùa, chửi.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: {
          type: 'STRING',
          description:
            'Điều cần nhớ, viết lại thành một câu ngắn, rõ chủ ngữ, tối đa 200 ký tự ' +
            '(ví dụ: "Bot là con mèo đen 2 mái", "Hằng ăn chay").',
        },
        replaceNoteId: {
          type: 'STRING',
          description:
            'Mã [nX] của điều đã ghi nhớ mà điều mới thay thế (cùng chủ đề, nội dung khác), lấy từ ' +
            'khối ĐIỀU ĐƯỢC DẶN. Bỏ trống nếu là điều mới.',
        },
      },
      required: ['text'],
    },
  },
  {
    name: TextToolType.FORGET_MEMORY,
    description:
      'Quên một điều đã ghi nhớ hoặc điều bot tự rút ra trong cuộc chat này. Gọi khi người dùng nói ' +
      '"quên vụ ... đi", "đừng nhớ ... nữa", "bỏ ghi nhớ ...". Ví dụ: "quên vụ mèo đen đi".',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Vài từ khoá của điều cần quên (ví dụ: "mèo đen").',
        },
      },
      required: ['query'],
    },
  },
  {
    name: TextToolType.ASK_CLARIFICATION,
    description:
      'Hỏi lại người dùng khi một yêu cầu cần dùng công cụ nhưng thiếu thông tin bắt buộc mà ' +
      'không suy ra được (ví dụ: nhờ nhắc sinh nhật mà không nói ngày nào, nói "âm lịch"). ' +
      'Gọi CÙNG LÚC với các tool cho phần đã đủ thông tin. Không dùng để trò chuyện, không hỏi ' +
      'lại điều đã rõ.',
    parameters: {
      type: 'OBJECT',
      properties: {
        question: {
          type: 'STRING',
          description:
            'Một câu hỏi ngắn bằng tiếng Việt về đúng thông tin còn thiếu, không emoji, không ' +
            'lời chào hay giải thích thêm (ví dụ: "Sinh nhật ngày nào để mình nhắc?").',
        },
      },
      required: ['question'],
    },
  },
];

/** Tools that only make sense in a ZCA thread with long-term chat memory on. */
const CHAT_MEMORY_TOOLS = new Set<string>([TextToolType.SEARCH_CHAT_HISTORY]);

/**
 * Tool catalog for one chat. Without long-term memory the history search is left out, so such
 * questions keep their chit-chat (or silent) behaviour instead of a "memory is off" notice.
 */
export function textToolDefinitionsFor(options: { longTermMemory: boolean }): LlmToolDefinition[] {
  return options.longTermMemory
    ? ZALO_TOOL_DEFINITIONS
    : ZALO_TOOL_DEFINITIONS.filter((def) => !CHAT_MEMORY_TOOLS.has(def.name));
}

/** Subset of `ZALO_TOOL_DEFINITIONS` limited to `allowed`, preserving the original order. */
export function selectToolDefinitions(allowed: readonly TextToolType[]): LlmToolDefinition[] {
  const allowedSet = new Set<string>(allowed);
  return ZALO_TOOL_DEFINITIONS.filter((def) => allowedSet.has(def.name));
}

export function isTextToolType(value: string): value is TextToolType {
  return (Object.values(TextToolType) as string[]).includes(value);
}
