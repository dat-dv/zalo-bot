---
metadata:
  agent-artifact:
    id: docs-global-zalo-command-intake
    type: documentation
    depends_on:
      - .agents/knowledge/global/zalo-command-intake.md
---

# Nhận lệnh Zalo

Hướng dẫn này ánh xạ trực tiếp với tri thức canonical [`zalo-command-intake.md`](../../knowledge/global/zalo-command-intake.md).

Hệ thống tiếp nhận lệnh và tin nhắn Zalo qua cơ chế 2 kênh song song (Dual-Channel Intake):

1. **Zalo Bot Platform Webhook**:
   - Endpoint: `POST /webhook` (quản lý bởi `ZaloController`).
   - Kiểm tra bảo mật qua header `X-Bot-Api-Secret-Token` (`ZALO_WEBHOOK_SECRET_TOKEN`).
   - Chuẩn hóa sự kiện qua `ZaloMessageParserService` thành `NormalizedZaloEvent`.
   - Kiểm tra danh sách trắng (Whitelist) và chống spam (cooldown 2 giây) qua `InputProcessorService`.
2. **ZCA Personal Account (`zca-js`)**:
   - Kết nối qua WebSocket tài khoản cá nhân Zalo, điều phối bởi `ZcaService`.
   - Lắng nghe tin nhắn và biểu cảm thông qua `ZcaBotFeatureService`.
   - Quy tắc kích hoạt linh hoạt: Hỗ trợ tiền tố gọi bot (mặc định `@bot`), cấu hình riêng theo từng kênh qua `thread_configs` (tùy chọn `requireMention` cho 1-1 chat hoặc nhóm).
   - Tiếp nhận sự kiện thả biểu cảm (Reactions): Thả tim (❤️) để duyệt, thả phẫn nộ (😡) để hủy.

- **Định tuyến lệnh & AI Tool Calling**:
   - Phân tích cú pháp qua `TextInputService`.
   - Lệnh nhanh (Fast-path: `/start`, `/help`, `/finance`, `/tasks`, `/drive`...) chuyển trực tiếp đến Strategy tương ứng trong `apps/api/src/zalo/text/strategies/`.
   - Ngôn ngữ tự nhiên tiếng Việt được chuyển tới `LlmService` (Gemini/OpenAI/Qwen) để trích xuất Tool Calling và tham số DTO.
- **Xác nhận 2 bước & Thu hồi tin nhắn**:
   - Mọi thao tác làm thay đổi dữ liệu nhạy cảm không thực thi ngay: bot phát sinh thẻ xác nhận 3 số ngẫu nhiên gắn với đúng người dùng và thời hạn 5 phút (`TransactionConfirmationService`).
   - Sau khi người dùng xác nhận hoặc hủy bỏ/hết hạn, bot tự động thu hồi thẻ xác nhận chờ (`undoMessage`) để đảm bảo không gian trò chuyện luôn sạch sẽ.
- **Kiểm thử**:
   - Lệnh unit test chuẩn: `npm run test --workspace @zalobot/api`. Lệnh này chạy toàn bộ các file `*.spec.ts` dưới `apps/api/src/`.

