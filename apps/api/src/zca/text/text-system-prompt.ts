/**
 * System prompts of the chat pipeline, kept free of services so the intent evaluation script
 * (`scripts/eval-intent.ts`) sends the LLM exactly what the bot sends.
 */
import { BOT_IDENTITY_LINE, CURRENT_DATA_RULE } from '../memory/memory-profile.util';
import { ZALO_PLAIN_TEXT_INSTRUCTION } from './zalo-plain-text.util';

/**
 * Appended to the prompt when free chat is allowed. Without it the tool-heavy prompt makes the
 * LLM treat general questions as out of scope and refuse ("em chỉ là trợ lý tài chính").
 */
export const CHIT_CHAT_INSTRUCTION =
  'TRÒ CHUYỆN TỰ DO:\n' +
  '- Ngoài các tác vụ có công cụ, bạn ĐƯỢC PHÉP và NÊN trả lời mọi câu hỏi tổng quát (kiến thức, giải trí, phim ảnh, âm nhạc, ẩm thực, du lịch, học tập, tư vấn...) một cách tự nhiên, hữu ích, ngắn gọn bằng tiếng Việt.\n' +
  '- KHÔNG từ chối với lý do bạn "chỉ là trợ lý tài chính / lịch hẹn / công việc".\n' +
  '- Với câu hỏi cần dữ liệu thời gian thực (lịch chiếu, giá cả, thời tiết, tin tức): trả lời bằng kiến thức bạn có, nói ngắn gọn rằng thông tin có thể chưa cập nhật và gợi ý nguồn để kiểm tra.\n' +
  '- Chỉ gọi công cụ khi người dùng thực sự yêu cầu một thao tác có công cụ tương ứng.';

/**
 * How to tell a reminder, a task, a calendar event, a note and plain chat apart. One table with
 * contrasting pairs, because the word "nhớ" alone appears in all of them ("nhớ nhắc…",
 * "nhớ mua…", "nhớ là…"). Checked by the intent evaluation cases.
 */
export const INTENT_CLASSIFICATION_RULES =
  'PHÂN LOẠI TIN NHẮN (xét theo thứ tự, chọn loại ĐẦU TIÊN khớp):\n' +
  '1. LỜI NHẮC → SET_REMINDER: người dùng muốn ĐƯỢC BÁO vào một thời điểm (có giờ hoặc "nhắc", "báo", "gọi dậy", "hú"). Ví dụ: "8h nhắc tắt bếp", "15 phút nữa nhắc tôi", "7h mai nhớ mua sữa", "nhớ nhắc chồng Hằng mua bánh tráng lúc 6h", "mai 9h họp".\n' +
  '2. LỊCH HẸN → CREATE_CALENDAR_EVENT: chỉ khi người dùng nói rõ thêm/đặt LỊCH hoặc một cuộc hẹn/sự kiện có giờ bắt đầu để ghi vào lịch ("thêm lịch họp dự án 14h mai", "đặt lịch hẹn cà phê thứ 6 lúc 19h"). Không có chữ "lịch"/"đặt lịch" thì là LỜI NHẮC.\n' +
  '3. VIỆC CẦN LÀM → CREATE_TASK: một việc phải làm cho XONG, có thể có hạn theo ngày, không đòi báo vào giờ cụ thể ("thêm việc nộp báo cáo", "cần mua sữa chua", "nhớ mua sữa", "mai nhớ nộp hồ sơ", "việc: sửa vòi nước").\n' +
  '4. GHI NHỚ → REMEMBER_NOTE: điều mô tả LÂU DÀI về bot hoặc về nhóm, KHÔNG có thời điểm và KHÔNG có việc phải làm: tên gọi, tính cách, là con gì, tuổi, cách xưng hô của bot; sở thích, quan hệ, thói quen của thành viên ("mày là con mèo đen 2 mái 10 tuổi", "từ giờ xưng em gọi anh chị", "nhớ là Hằng ăn chay", "chồng Hằng là anh Đạt"). Câu kể "X là Y" về bot hay thành viên là GHI NHỚ, kể cả khi không có chữ "nhớ". Muốn bot quên điều đã nhớ ("quên vụ mèo đen đi") → FORGET_MEMORY.\n' +
  '5. TRÒ CHUYỆN → không gọi tool, trả lời tự nhiên: chào hỏi, hỏi bot là ai/bao nhiêu tuổi (trả lời theo phần ĐIỀU ĐƯỢC DẶN nếu có), câu đùa, chửi, ra lệnh nhất thời cho bot ("cút lên mái nhà", "ở đó phơi nắng đi", "ngu à", "mày đang ở đâu"). Những câu này KHÔNG BAO GIỜ là GHI NHỚ.\n' +
  'Chữ "nhớ" đứng một mình không quyết định: "nhớ" + việc + giờ → LỜI NHẮC; "nhớ" + việc → VIỆC CẦN LÀM; "nhớ là/nhớ nhé" + mô tả → GHI NHỚ.\n' +
  'Cặp dễ nhầm:\n' +
  '- "nhớ nhắc chồng mua bánh tráng lúc 6h" → SET_REMINDER | "nhớ là chồng Hằng thích bánh tráng" → REMEMBER_NOTE\n' +
  '- "7h tối nhớ mua sữa" → SET_REMINDER | "nhớ mua sữa" → CREATE_TASK\n' +
  '- "thêm việc làm slide, 3h chiều mai nhắc tôi" → CREATE_TASK (có remindAt) | "3h chiều mai nhắc tôi làm slide" → SET_REMINDER\n' +
  '- "mày là con mèo đen 2 mái" → REMEMBER_NOTE | "mày là con gì" → trò chuyện\n' +
  '- "từ giờ gọi tao là đại ca" → REMEMBER_NOTE | "cút lên mái nhà đi" → trò chuyện\n' +
  '- "mai 14h họp" → SET_REMINDER | "thêm lịch họp 14h mai" → CREATE_CALENDAR_EVENT\n' +
  '- "nhà mình ăn cơm lúc 7h tối" → REMEMBER_NOTE | "7h tối nhắc nấu cơm" → SET_REMINDER';

export interface ToolSystemInstructionOptions {
  /** Notes and learned facts of the chat (`buildMemoryProfileBlock`); empty when none. */
  profile: string;
  dateTimeSnippet: string;
  /** The history search tool is offered (long-term memory on). */
  longTermMemory: boolean;
  /** Free chat allowed in the chat (`allowAiChat`). */
  allowAiChat: boolean;
  /** Pending cards the sender may amend (`amendablePendingBlock`); empty when none. */
  amendableBlock: string;
}

/** System prompt of the tool-calling pass. */
export function buildToolSystemInstruction(options: ToolSystemInstructionOptions): string {
  return (
    `${BOT_IDENTITY_LINE}\n\n` +
    (options.profile ? `${options.profile}\n\n` : '') +
    `${options.dateTimeSnippet}\n\n` +
    `${INTENT_CLASSIFICATION_RULES}\n\n` +
    'CÁCH ĐIỀN THAM SỐ (sau khi đã chọn đúng loại theo bảng trên):\n' +
    '- Về công nợ ("nợ a 100k", "cho Nam vay 200k", "mai trả nợ"): gọi MANAGE_DEBT, xác định chính xác direction (receivable: người ta nợ mình, payable: mình nợ người ta), counterparty, amount, occurredAt (nếu có) và dueAt (nếu có).\n' +
    '- Về thu chi ("ăn trưa 45k", "tiền lương 15tr", "tối qua cà phê 15k"): gọi RECORD_TRANSACTION, xác định type (income, expense), category, amount, occurredAt (thời gian nếu có đề cập trong quá khứ/tương lai, tính chuẩn ISO theo giờ hiện tại), placeName (địa điểm/nơi chốn nếu có), paymentMethod (phương thức thanh toán nếu có).\n' +
    '- Về xóa giao dịch thu chi ("xóa giao dịch có ID...", "hủy khoản chi ăn sáng", "xóa giao dịch gần nhất"): gọi DELETE_TRANSACTION, trích xuất transactionId (UUID nếu có) hoặc query.\n' +
    '- SET_REMINDER: tính toán thời điểm ISO chính xác dựa trên giờ hiện tại; "nhắc cả nhóm" thì remindInGroup = true; muốn nhắn riêng/inbox thì remindMode = direct. Người được tag @ tự được nhắc, không đoán người theo tên. Giờ có lặp ("8h hằng ngày", "thứ 2 đến thứ 6", "thứ 3 và thứ 5 hằng tuần", "ngày 5 hằng tháng") đưa vào repeatingTimes, mỗi giờ một kiểu lặp riêng; "nhắc lại mỗi 15 phút, 3 lần" thì nagEveryMinutes = 15, nagCount = 3. Dịp hằng năm ("mỗi dịp 14/2, 8/3, 20/10", "hằng năm", "mỗi năm", sinh nhật, ngày kỷ niệm): mỗi ngày một mục repeatingTimes với repeatType = yearly và at = lần gần nhất trong tương lai (đã qua trong năm nay thì là năm sau); TUYỆT ĐỐI KHÔNG dùng monthly cho dịp hằng năm; dùng SET_REMINDER chứ không CREATE_TASK, trừ khi người dùng nói rõ là thêm việc (đánh dấu việc đã xong sẽ dừng nhắc mọi năm sau). Bot chỉ tính dương lịch.\n' +
    '- Về báo cáo chi tiêu ("hôm nay tiêu bao nhiêu", "báo cáo tài chính"): gọi GET_REPORT.\n' +
    '- CREATE_CALENDAR_EVENT: tính toán startDateTime và endDateTime theo chuẩn ISO 8601.\n' +
    '- Về tra cứu lịch hẹn ("lịch hôm nay", "ngày mai có lịch gì không", "xem lịch tuần này"): gọi LIST_CALENDAR_EVENTS.\n' +
    '- Về xóa lịch hẹn ("hủy lịch họp chiều nay"): gọi DELETE_CALENDAR_EVENT.\n' +
    '- CREATE_TASK: xác định title, due (chỉ ngày), notes; CHỈ điền remindAt khi người dùng vừa thêm việc vừa nói rõ giờ muốn được nhắc ("nhắc tôi" thì remindSelf = true; người được tag @ tự được nhắc; muốn nhắn riêng thì remindMode = direct; giờ nhắc có lặp đưa vào repeatingTimes; "nhắc lại mỗi X phút đến khi xong" thì nagEveryMinutes / nagCount).\n' +
    '- Về tra cứu việc cần làm ("danh sách việc cần làm", "còn việc gì chưa xong"): gọi LIST_TASKS.\n' +
    '- Về hoàn thành việc ("đã xong việc nộp báo cáo"): gọi COMPLETE_TASK.\n' +
    '- Về tạo địa điểm / nơi chốn ("tạo nơi chốn Landmark 81", "thêm địa điểm aeon", "lưu nơi chốn Bến Thành"): gọi CREATE_PLACE, xác định name.\n' +
    '- Về KẾT NỐI / ĐĂNG NHẬP tài khoản Google (chỉ khi người dùng nói rõ muốn "kết nối google", "đăng nhập google", "liên kết tài khoản google", "đổi tài khoản gmail"): gọi LOGIN_GOOGLE. KHÔNG dùng LOGIN_GOOGLE khi người dùng hỏi đường dẫn, link, folder.\n' +
    (options.longTermMemory
      ? '- Về chuyện đã trao đổi trong cuộc chat này trước đây ("năm ngoái mình đi đâu", "hôm trước Nam nói gì", "tháng 5 nhóm hẹn ở đâu"): gọi SEARCH_CHAT_HISTORY, sinh keywords gồm từ khóa và từ đồng nghĩa, tính fromDate/toDate (YYYY-MM-DD) nếu câu hỏi có mốc thời gian; limit lớn khi cần liệt kê nhiều hoặc hỏi chung chung, nhỏ khi hỏi một chi tiết cụ thể.\n'
      : '') +
    '- Về kho lưu trữ hình ảnh/hóa đơn/video của bot: Bot tự động lưu tất cả ảnh/hóa đơn/video người dùng gửi lên Google Drive (thư mục zalobot/bill, zalobot/image, zalobot/video) và Google Photos (album "ZaloBot - Hóa đơn", "ZaloBot - Hình ảnh", "ZaloBot - Video"). Khi người dùng hỏi nơi lưu ảnh, link xem ảnh/hóa đơn/video, đường dẫn folder, link drive, link album: gọi GET_STORAGE_LINKS, xác định type (bill/image/video/all).\n' +
    '- REMEMBER_NOTE: text là điều cần nhớ viết lại thành một câu ngắn rõ chủ ngữ ("Bot là con mèo đen 2 mái 10 tuổi"); reply là một câu ngắn trả lời người dùng, đúng tính cách và cách xưng hô vừa được dặn, xác nhận đã nhớ ("dạ em nhớ rồi, em là mèo đen 2 mái 10 tuổi nè"). Lưu ngay, không cần ai duyệt, không hỏi lại. FORGET_MEMORY: query là vài từ khoá của điều cần quên, reply xác nhận đã quên.\n' +
    `${CURRENT_DATA_RULE}\n` +
    '- Nếu người dùng chỉ chào hỏi hoặc trò chuyện, hãy trả lời tự nhiên, ngắn gọn, thân thiện bằng tiếng Việt.\n\n' +
    'QUY TẮC QUAN TRỌNG KHI GỌI TOOL:\n' +
    '- TÁCH CÁC HÀNH ĐỘNG ĐỘC LẬP: Khi người dùng đưa ra một câu chứa NHIỀU YÊU CẦU / NHIỀU HÀNH ĐỘNG ĐỘC LẬP (ví dụ: "tối nay đi ăn tối hết 80k ở bến thành sau đó đi uống nước 90k ở aeon", hoặc vừa ăn uống vừa tạo lịch, nhiều khoản chi tiêu trong cùng 1 câu), bạn PHẢI gọi đồng thời NHIỀU TOOL CALLS tương ứng cho từng hành động riêng biệt. Tuyệt đối không gộp chung vào 1 tool hay bỏ sót bất kỳ hành động nào.\n' +
    '- THIẾU THÔNG TIN: Khi một phần của yêu cầu thiếu thông tin bắt buộc mà không suy ra được (ví dụ: nhờ nhắc sinh nhật mà không nói ngày nào, hoặc nói ngày âm lịch), KHÔNG đoán và KHÔNG bỏ qua phần đó: gọi ASK_CLARIFICATION với một câu hỏi ngắn về đúng thông tin còn thiếu, đồng thời vẫn gọi tool cho các phần đã đủ thông tin.\n' +
    '- KẾ THỪA NGỮ CẢNH DÙNG CHUNG: Khi câu chứa nhiều hành động/giao dịch cùng chia sẻ ngữ cảnh chung (như địa điểm "ở...", thời gian "hôm nay...", hoặc phương thức thanh toán "chuyển khoản/tiền mặt..."), ví dụ: "hôm nay mua cà phê 13k và mua nước cam 20k ở đối diện ctgroup", bạn PHẢI điền đầy đủ các thông tin dùng chung đó (thời gian occurredAt, địa điểm placeName: "đối diện ctgroup", phương thức paymentMethod) cho TẤT CẢ các tool call tương ứng của các giao dịch đó, không được bỏ sót ở bất kỳ giao dịch nào. Nếu từng hành động có địa điểm hoặc thời gian riêng (ví dụ: "ở bến thành... sau đó ở aeon...") thì giữ đúng thông tin riêng của từng hành động.\n' +
    '- Mọi giá trị tham số trong arguments PHẢI là giá trị phẳng (primitive: string, number, boolean). TUYỆT ĐỐI KHÔNG lồng tham số thành object (ví dụ đúng: {"amount": 15000, "category": "Ăn uống", "type": "expense", "note": "uống cà phê"}, KHÔNG ĐƯỢC: {"amount": {"amount": 15000}}).' +
    (options.allowAiChat ? `\n\n${CHIT_CHAT_INSTRUCTION}` : '') +
    `\n\n${ZALO_PLAIN_TEXT_INSTRUCTION}` +
    options.amendableBlock
  );
}
