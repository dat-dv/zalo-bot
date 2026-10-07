# Kế Hoạch Triển Khai: Mặc Định Giờ Hiện Tại, Ngày Phát Sinh (Input Muộn) & Xác Nhận JSON Cho Thu–Chi

## Tổng quan & Mục tiêu

Khi người dùng ghi nhận các khoản thu chi qua zalo Bot (bằng văn bản, giọng nói hoặc hình ảnh hoá đơn), hệ thống cần đáp ứng 3 yêu cầu cốt lõi:

1. **Mặc định giờ hiện tại**: Nếu người dùng không nêu ngày/giờ cụ thể (ví dụ: _"ăn trưa 65k"_, _"mua cafe 30k"_), hệ thống tự động gán thời gian phát sinh giao dịch (`occurredAt`) là thời điểm hiện tại theo múi giờ `Asia/Ho_Chi_Minh`.
2. **Hỗ trợ ngày phát hành / ngày phát sinh khi input muộn**: Khi người dùng ghi nhận muộn các khoản thu/chi phát sinh trong quá khứ (ví dụ: _"hôm qua ăn tối 150k"_, _"ngày 20/08 đổ xăng 100k"_, _"thứ 6 tuần trước nhận lương 15tr"_), AI sẽ phân tích mốc thời gian thực tế để trích xuất chính xác ngày phát sinh (`occurredAt` theo ISO-8601 có múi giờ).
3. **Xác nhận JSON (JSON Preview)**: Trong hộp thoại xác nhận zalo trước khi bấm **Xác nhận**, ngoài thẻ thông tin trực quan (Loại, Số tiền, Danh mục, Nội dung, Ngày phát sinh), hệ thống sẽ hiển thị khối JSON payload có cấu trúc (`<pre>...</pre>`) để người dùng kiểm tra chính xác dữ liệu trước khi lưu vào cơ sở dữ liệu.

---

## Chi tiết các thay đổi đề xuất

### 1. Gemini AI System Instruction & Tool Definitions (`apps/api/src/gemini/`)

- **[MODIFY] [`apps/api/src/gemini/helpers/gemini-prompt.helper.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/helpers/gemini-prompt.helper.ts)**:
  - Cập nhật mục 2.d (Thẻ xác nhận thu–chi) và mục 6 (Sổ thu–chi) trong System Instruction:
    - Hướng dẫn Gemini luôn tự động gán trường `occurredAt` bằng mốc thời gian hiện tại (`nowIso`) khi người dùng không chỉ định ngày giờ.
    - Hướng dẫn Gemini phân tích và chuyển đổi chính xác mốc thời gian quá khứ thành `occurredAt` (ISO-8601) khi người dùng nói các từ ngữ chỉ thời gian như _"hôm qua"_, _"hôm kia"_, _"ngày DD/MM"_, _"thứ X tuần trước"_.
    - Nêu rõ định dạng thẻ xác nhận và cấu trúc JSON payload cho giao dịch thu–chi.
- **[MODIFY] [`apps/api/src/gemini/tools/create-finance-transaction.tool.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/tools/create-finance-transaction.tool.ts)**:
  - Cập nhật mô tả tool và tham số `occurredAt` trong `FunctionDeclaration` để Gemini ưu tiên điền `occurredAt` (mặc định giờ hiện tại hoặc mốc quá khứ nếu input muộn).
- **[MODIFY] [`apps/api/src/gemini/gemini.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.service.ts)**:
  - Khi đưa `create_finance_transaction` vào hàng chờ xác nhận (`queueToolConfirmation`), nếu payload chưa có `occurredAt`, tự động gán `occurredAt: this.getCurrentTimeInfo().nowIso` để khối JSON preview luôn có đầy đủ trường thời gian phát sinh.

---

### 2. Giao diện Xác nhận & Kết quả trên zalo (`apps/api/src/zalo/`)

- **[MODIFY] [`apps/api/src/zalo/services/zalo-ui.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.ts)**:
  - Cập nhật `formatConfirmationBox` cho `create_finance_transaction`:
    - Hiển thị dòng ngày phát sinh / ngày phát hành (format tiếng Việt: `📅 Ngày phát sinh: DD/MM/YYYY HH:mm` hoặc `HH:mm - Thứ X, DD/MM/YYYY`).
    - Bổ sung khối JSON code block (`<pre>{\n  "type": "...",\n  "amount": ...,\n  "category": "...",\n  "note": "...",\n  "occurredAt": "..."\n}</pre>`) hiển thị rõ ràng payload trước khi ghi sổ.
  - Cập nhật `formatResultBox` cho `create_finance_transaction`:
    - Hiển thị thông báo sau khi xác nhận thành công: `✅ Đã ghi sổ thu–chi · [Khoản thu/chi] [Số tiền] · [Nội dung] (Ngày: DD/MM/YYYY HH:mm)`.
- **[MODIFY] [`apps/api/src/zalo/services/zalo-ui.service.spec.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.spec.ts)**:
  - Cập nhật test cases kiểm tra `formatConfirmationBox` của `create_finance_transaction` bao gồm kiểm tra `occurredAt` và khối JSON payload.
  - Thêm test case cho `formatResultBox` khi ghi sổ thu–chi thành công.

---

### 3. Đồng bộ Tài liệu & Tri thức Hệ thống

- **[MODIFY] [`.agents/knowledge/global/zalo-response-layout.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/zalo-response-layout.md)**:
  - Ghi nhận chuẩn hiển thị thẻ xác nhận thu–chi có ngày phát sinh và JSON payload preview.
- **[NEW] [`.agents/knowledge/modules/finance/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/finance/README.md)** & **[NEW] [`.agents/docs/modules/finance/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/finance/README.md)**:
  - Tài liệu hóa quy trình ghi nhận thu–chi, cơ chế xử lý thời gian phát sinh mặc định / input muộn và xác nhận JSON payload.
- **[MODIFY] [`.agents/docs/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/README.md)**:
  - Đồng bộ bảng ánh xạ tài liệu.

---

## Kế hoạch Kiểm thử & Xác minh

### 1. Kiểm thử Tự động (Automated Unit Tests)

- Chạy test suite: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/**/*.spec.ts`
- Chạy kiểm tra kiểu: `npm run typecheck`
- Chạy kiểm tra linter & formatting: `npm run lint:check`
- Chạy kiểm tra tính toàn vẹn hệ thống: `npm run agent-system:validate`

### 2. Xác minh Kịch bản Nghiệp vụ (Scenario Verification)

1. **Kịch bản 1 (Mặc định thời gian hiện tại)**: Nhập _"ăn trưa 65k"_ -> Kiểm tra payload xác nhận có `occurredAt` là thời điểm hiện tại và JSON preview hiển thị đầy đủ các trường `type`, `amount`, `category`, `note`, `occurredAt`.
2. **Kịch bản 2 (Input muộn có ngày phát sinh)**: Nhập _"hôm qua đổ xăng 100k"_ -> Kiểm tra payload xác nhận có `occurredAt` trỏ về đúng ngày hôm qua.
3. **Kịch bản 3 (Xác nhận & Lưu vào DB)**: Bấm nút **Xác nhận** -> Giao dịch được lưu vào bảng `finance_transactions` với đúng `occurred_at` và hiển thị kết quả thành công gọn gàng.
