# Kế hoạch bổ sung tính năng tạo người liên quan độc lập (create_debt_contact)

## Hiện trạng & Vấn đề

Khi người dùng yêu cầu chỉ tạo người liên quan (ví dụ: _"Chỉ tạo người liên quan thôi tên là Đức CMC chứ k tách ra"_):

1. **Thiếu công cụ tạo người liên quan độc lập**: Hệ thống chỉ có `resolve_debt_contact` (tra cứu) và `update_debt_contact` (sửa tên), chưa có công cụ `create_debt_contact` để tạo người liên quan mới một cách độc lập (tương tự như `create_finance_place` dành cho nơi chốn).
2. **AI bị giới hạn**: Do không có công cụ tạo độc lập, AI Gemini buộc phải deflecting/hỏi người dùng muốn vay hay cho mượn bao nhiêu tiền để tạo khoản nợ kèm theo (`create_debt` với `createNewContact: true`).
3. **Cần tôn trọng tên hiển thị của người dùng**: Khi người dùng yêu cầu giữ nguyên tên không tách biệt danh (ví dụ _"tên là Đức CMC chứ k tách ra"_), AI cần giữ nguyên trường `name: "Đức CMC"` thay vì cố phân tách thành tên "Đức" và biệt danh "CMC".

---

## User Review Required

> [!NOTE]
> Tính năng mới sẽ bổ sung công cụ `create_debt_contact` vào hệ thống tool calling của Gemini:
>
> - Cho phép tạo người liên quan độc lập với tên, biệt danh (nếu có), địa chỉ/mô tả (descriptor), số điện thoại (nếu có).
> - Tuân thủ quy tắc **Resolve-First**: Tra cứu qua `resolve_debt_contact` trước. Nếu chưa có (`count === 0`), gọi `create_debt_contact`.
> - Kích hoạt hộp thoại xác nhận zalo minh bạch trước khi lưu vào CSDL.
> - Tuyệt đối không ép người dùng phải có khoản nợ hay hỏi số tiền vay/mượn khi họ chỉ yêu cầu tạo người liên quan.

---

## Proposed Changes

### 1. Backend Gemini Tools (`apps/api/src/gemini/tools/`)

#### [NEW] [create-debt-contact.tool.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/tools/create-debt-contact.tool.ts)

- Khai báo tool `create_debt_contact` với schema nhận các trường: `name` (bắt buộc), `alias`, `descriptor` (mô tả/địa chỉ), `phoneNumber`, `bankAccountNumber`, `bankCode`, `bankName`.
- Thực thi gọi `this.financeService.createContact(...)` để tạo mới trong bảng `debt_contacts`.

#### [NEW] [create-debt-contact.tool.spec.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/tools/create-debt-contact.tool.spec.ts)

- Bổ sung unit tests kiểm tra: tạo thành công đầy đủ trường, tạo thành công chỉ với tên, và báo lỗi khi tên rỗng.

---

### 2. Module Registration & Confirmation (`apps/api/src/gemini/`)

#### [MODIFY] [gemini.module.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.module.ts)

- Khai báo và export `CreateDebtContactTool`.

#### [MODIFY] [gemini.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.service.ts)

- Inject `CreateDebtContactTool` vào constructor và đăng ký vào mảng `tools`.
- Thêm `'create_debt_contact'` vào `confirmationRequiredTools` để kích hoạt giao diện thẻ xác nhận zalo.

#### [MODIFY] [gemini-prompt.helper.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/helpers/gemini-prompt.helper.ts)

- Thêm `create_debt_contact` vào danh sách công cụ mục 7.
- Chỉ dẫn rõ ràng: Khi người dùng chỉ muốn tạo người liên quan mới một cách độc lập (không kèm số tiền nợ), gọi `resolve_debt_contact` trước. Nếu chưa có, gọi `create_debt_contact`. Tuyệt đối không hỏi người dùng số tiền nợ hoặc ép tạo khoản nợ. Tôn trọng yêu cầu không tách biệt danh của người dùng.

---

### 3. zalo UI Service (`apps/api/src/zalo/services/`)

#### [MODIFY] [zalo-ui.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.ts)

- Định dạng thẻ xác nhận (`formatConfirmationCard`): `⚠️ XÁC NHẬN TẠO NGƯỜI LIÊN QUAN` kèm Tên, Biệt danh, Mô tả/Địa chỉ, SĐT.
- Định dạng tác động hệ thống (`formatImpactExplanation`): nêu rõ tác động khi Xác nhận / Hủy bỏ.
- Định dạng kết quả sau xác nhận (`formatResultBox`): `✅ Đã tạo người liên quan · 👤 <Tên>`.
- Định dạng tóm tắt gốc (`formatOriginalSummary`).

#### [MODIFY] [zalo-ui.service.spec.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.spec.ts)

- Thêm unit test kiểm tra hiển thị thẻ xác nhận và kết quả của `create_debt_contact`.

---

### 4. Đồng bộ Tài liệu Tri thức (`.agents/`)

#### [MODIFY] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/finance/README.md)

- Ghi nhận công cụ `create_debt_contact` cho phép tạo độc lập người liên quan qua AI assistant zalo.

#### [MODIFY] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/finance/README.md)

- Cập nhật tài liệu hướng dẫn tiếng Việt mô tả tính năng tra cứu và tạo người liên quan độc lập của Gemini.

---

## Verification Plan

### Automated Tests

- Chạy unit test mới cho tool: `npx tsx --test apps/api/src/gemini/tools/create-debt-contact.tool.spec.ts`
- Chạy test zalo UI: `npx tsx --test apps/api/src/zalo/services/zalo-ui.service.spec.ts`
- Chạy toàn bộ test suite backend: `npm run test --workspace @zalobot/api`
- Chạy typecheck: `npm run typecheck`
- Chạy lint: `npm run lint`
- Chạy validate agent system: `npm run agent-system:validate`

### Manual Verification

- Kiểm tra các mẫu câu:
  1. _"Chỉ tạo người liên quan thôi tên là Đức CMC chứ k tách ra"_ -> AI gọi `resolve_debt_contact` rồi gọi `create_debt_contact` với `name: "Đức CMC"`.
  2. _"Thêm người liên quan anh Tuấn số 90 Quảng Hiền"_ -> AI gọi `resolve_debt_contact` rồi gọi `create_debt_contact` với `name: "Tuấn"`, `descriptor: "số 90 Quảng Hiền"`.
