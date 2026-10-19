# Kế Hoạch Di Chuyển Tầng Tương Tác & Quản Lý Asset Sang ZcaModule, Giữ Lại Tầng Tool Calling Cho ZaloModule

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tái cấu trúc kiến trúc hệ thống để `ZcaModule` trở thành trung tâm điều phối toàn bộ luồng tương tác Zalo (kết nối WebSocket, tiếp nhận tin nhắn, quản lý hình ảnh/asset, xác nhận giao dịch 3 số/reaction, thu hồi tin nhắn, phân quyền & whitelist), đồng thời tinh gọn `ZaloModule` chỉ chuyên trách tầng phân tích AI & thực thi công cụ (AI Tool Calling & Fast-path Tool Strategies).

**Architecture:** 
- `ZcaModule`: Đóng vai trò Channel & Interaction Orchestrator duy nhất:
  - Tiếp nhận tin nhắn văn bản, đa phương tiện (ảnh, video, file, voice), và reactions từ ZCA client.
  - Quản lý vòng đời ảnh tương tác (`PendingImageActionService`, `ImageBatchHandler`, các strategies: tạo hóa đơn, lưu kho Drive/Photos, hủy).
  - Quản lý vòng đời xác nhận giao dịch (`TransactionConfirmationService`, `dto-descriptor.util`, duyệt bằng tim ❤️ / phẫn nộ 😡, thu hồi thẻ cũ `undoMessage`).
  - Quản lý phân quyền truy cập (`InitialAdminBootstrapGuard`, `GrantAccessGuard`, anti-spam cooldown).
- `ZaloModule`: Đóng vai trò Tool Execution Layer (chỉ chứa các Tool Calls):
  - Nhận text đã làm sạch và ngữ cảnh từ `ZcaModule`.
  - Phân tích LLM (`llmService.generate` + `ZALO_TOOL_DEFINITIONS`) thành các tool calls.
  - Thực thi các tool nghiệp vụ (Finance, Debts, Google Calendar, Google Tasks, Reminders, Places, Drive sharing, Quick tools). Khi tool cần sinh thẻ xác nhận tương tác, nó ủy quyền qua `TransactionConfirmationService` của `ZcaModule`.

**Tech Stack:** NestJS, TypeScript, `zca-js`, Redis (`ioredis`), Google Drive API v3, PostgreSQL (TypeORM), `node:test`.

**Spec:** Yêu cầu từ user: "gom về zca modules hết cho anh đi, để lại các toolcall cơ bản cho zalo modules xử lý thôi".

---

## Global Constraints

- Không làm gián đoạn các tính năng hiện tại: duyệt thu chi bằng reaction (❤️/😡), dọn dẹp tin nhắn tạm (`undoMessage`), tự động sao lưu media nhóm chat, quét lịch sử media (`syncThreadMediaHistory`).
- Đảm bảo tính nhất quán của Redis keys (`pending:tx:*`, `pending:image:*`, `zca:session`, `zca:synced_media:*`).
- Tránh Circular Dependency giữa `ZcaModule` và `ZaloModule` bằng cách phân tách interface rõ ràng và sử dụng `forwardRef()` khi cần thiết.
- Đảm bảo 100% các unit test của hệ thống vượt qua (`npm test`).

## Review Focus

1. **Interactive Image Flow in ZCA:** Khi người dùng gửi ảnh trực tiếp đến bot qua ZCA (chat cá nhân hoặc tag bot trong group), `ImageBatchHandler` và `PendingImageActionService` phải kích hoạt chính xác menu lựa chọn (1: Quét hóa đơn, 2: Lưu kho, hủy).
2. **Confirmation & Recall:** Duyệt yêu cầu (bằng tim ❤️ hoặc lệnh `yes <code>`) phải thu hồi sạch sẽ các tin nhắn tạm qua `ZcaService.undo` và để lại thông điệp kết quả cuối cùng.
3. **Decoupled Tool Calling:** Các tool strategy trong `ZaloModule` vẫn gọi được `TransactionConfirmationService` mà không bị lỗi vòng lặp phụ thuộc (circular dependency).
4. **Guard Protection:** Các tin nhắn trong ZCA trực tiếp phải được bảo vệ bởi `InitialAdminBootstrapGuard`, `GrantAccessGuard` và cơ chế Cooldown.
5. **Clean Architecture:** `ZaloModule` không còn ôm logic thu hồi tin nhắn hay xử lý sự kiện ZCA, chỉ tập trung vào Tool Definitions & Tool Strategies.

---

### Task 1: Di chuyển & Tái cấu trúc Quản lý Ảnh Tương tác (`PendingImageAction`) sang `ZcaModule`

**Files:**
- Move: `apps/api/src/zalo/pending-image-action.service.ts` -> `apps/api/src/zca/pending-image/pending-image-action.service.ts`
- Move: `apps/api/src/zalo/pending-image/*` -> `apps/api/src/zca/pending-image/*`
- Update: `apps/api/src/zca/zca.module.ts`
- Test: `apps/api/src/zca/pending-image/pending-image.spec.ts`

**Interfaces:**
- `PendingImageActionService`
- `PendingImageActionDispatcher`
- `ImageBatchHandler`
- `CreateBillPendingImageStrategy`, `StorageUploadPendingImageStrategy`, `CancelPendingImageStrategy`

- [ ] **Step 1: Di chuyển thư mục `pending-image` và service sang `apps/api/src/zca/pending-image/`**
      - Chuyển `PendingImageActionService`, `ImageBatchHandler`, `PendingImageActionDispatcher`, và 3 strategy (`create-bill`, `storage-upload`, `cancel`).
      - Cập nhật các đường dẫn import sang `ZcaService` thay vì `ZaloService`.

- [ ] **Step 2: Đăng ký các providers vào `ZcaModule` và export để chia sẻ**
      - Cập nhật `apps/api/src/zca/zca.module.ts`: thêm `PendingImageActionService`, `PendingImageActionDispatcher`, `ImageBatchHandler`, các strategies vào `providers` và `exports`.

- [ ] **Step 3: Cập nhật unit test và chạy thử nghiệm**
      - Chạy `npm test apps/api/src/zca/pending-image/` để xác nhận logic lưu pending image và batching hoạt động ổn định.

---

### Task 2: Di chuyển Hệ thống Xác nhận & Thu hồi Tin nhắn (`TransactionConfirmationService`) sang `ZcaModule`

**Files:**
- Move: `apps/api/src/zalo/transaction-confirmation.service.ts` -> `apps/api/src/zca/confirmation/transaction-confirmation.service.ts`
- Move: `apps/api/src/zalo/confirmation/dto-descriptor.util.ts` -> `apps/api/src/zca/confirmation/dto-descriptor.util.ts`
- Update: `apps/api/src/zca/confirmation/transaction-confirmation.service.ts`
- Update: `apps/api/src/zca/zca.module.ts`
- Test: `apps/api/src/zca/confirmation/transaction-confirmation.service.spec.ts`

**Interfaces:**
- `TransactionConfirmationService.createPendingAction(...)`
- `TransactionConfirmationService.handleCommand(...)`
- `TransactionConfirmationService.handleReaction(...)`
- `TransactionConfirmationService.recallTempMessages(...)`

- [ ] **Step 1: Di chuyển `TransactionConfirmationService` và `dto-descriptor.util.ts` vào `apps/api/src/zca/confirmation/`**
      - Chuyển phụ thuộc gửi/thu hồi tin nhắn từ `ZaloService` sang `ZcaService` trực tiếp (gọi `this.zcaService.sendMessage` và `this.zcaService.undo`).
      - Cập nhật hàm `sendMessageWithResult` và `undoMessage` để tận dụng trực tiếp kết nối WebSocket và cache `cliMsgId` của `ZcaService`.

- [ ] **Step 2: Đăng ký `TransactionConfirmationService` vào `ZcaModule` và export**
      - Thêm vào `providers` và `exports` trong `apps/api/src/zca/zca.module.ts`.

- [ ] **Step 3: Cập nhật các import trong các Tool Strategies của `ZaloModule`**
      - Sửa đường dẫn import `TransactionConfirmationService` trong các file: `record-transaction-tool.strategy.ts`, `manage-debt-tool.strategy.ts`, `set-reminder-tool.strategy.ts`, `create-calendar-event-tool.strategy.ts`, v.v. trỏ sang `apps/api/src/zca/confirmation/transaction-confirmation.service`.

- [ ] **Step 4: Chạy unit test xác nhận**
      - Chạy `npm test apps/api/src/zca/confirmation/` đảm bảo các kịch bản thả tim, hủy, timeout 5 phút, và thu hồi tin nhắn pass 100%.

---

### Task 3: Di chuyển Guards Phân Quyền (`InitialAdminBootstrapGuard`, `GrantAccessGuard`) sang `ZcaModule`

**Files:**
- Move: `apps/api/src/zalo/guards/*` -> `apps/api/src/zca/guards/*`
- Update: `apps/api/src/zca/guards/initial-admin-bootstrap.guard.ts`
- Update: `apps/api/src/zca/guards/grant-access.guard.ts`
- Update: `apps/api/src/zca/zca.module.ts`

**Interfaces:**
- `InitialAdminBootstrapGuard.canActivate(input: AgentInput): Promise<boolean>`
- `GrantAccessGuard.canActivate(input: AgentInput): Promise<boolean>`

- [ ] **Step 1: Di chuyển guards sang `apps/api/src/zca/guards/`**
      - Cập nhật `ZcaService` để gửi thông báo từ chối truy cập / cấp quyền admin.

- [ ] **Step 2: Đăng ký Guards vào `ZcaModule` và tích hợp vào luồng tin nhắn ZCA**
      - Tích hợp kiểm tra Guard trực tiếp trong `ZcaBotFeatureService` hoặc service tiền xử lý của ZCA trước khi dispatch tin nhắn tới các tính năng bot.

---

### Task 4: Nâng cấp `ZcaBotFeatureService` Trở thành Bộ Điều Phối Tương Tác Zalo Đầy Đủ

**Files:**
- Modify: `apps/api/src/zca/zca-bot-feature.service.ts`
- Test: `apps/api/src/zca/zca-bot-feature.service.spec.ts`

**Interfaces:**
- `ZcaBotFeatureService.onMessage(message: Message, api: API): Promise<void>`
- `ZcaBotFeatureService.onReaction(reaction: Reaction, api: API): Promise<void>`

- [x] **Step 1: Tích hợp xử lý ảnh tương tác & Trích xuất ảnh từ Tin nhắn Trích dẫn (Quote Reply) vào `onMessage`**
      - **Ảnh gửi thông thường (không tag @bot)**: Chỉ âm thầm sao lưu lên Google Drive nếu nhóm/thread bật `mediaBackup.enabled`, không hiện menu hay làm rác nhóm chat.
      - **Ảnh gửi kèm caption có tag @bot**: Chạy OCR trích xuất nội dung hóa đơn/ảnh, kết hợp với caption của người dùng, tải ảnh lên Drive thư mục `bill` để lấy `imageUrl`, và gửi sang `TextInputService` (`ZaloModule`) để kích hoạt tool nghiệp vụ.
      - **Tin nhắn Reply (Trích dẫn) ảnh cũ với tag @bot**: Phát hiện `message.data.quote` chứa ảnh (`quote.attach`), trích xuất link ảnh gốc, chạy OCR đọc chữ, ghép `[Nội dung OCR từ ảnh] + [Lời dặn của người dùng]` và đẩy sang `ZaloModule` để gọi tool tương ứng.
      - Trong chat 1-1 riêng với Bot: Nếu gửi ảnh đơn thuần không chú thích, kích hoạt menu phím 1 (OCR hóa đơn), phím 2 (Lưu kho Drive), và hủy.

- [x] **Step 2: Tích hợp xử lý video tương tác**
      - Khi người dùng gửi video trực tiếp cho bot, tải buffer và gọi `MediaStorageService.uploadVideo` tương tự luồng trước đây.

- [x] **Step 3: Chuyển tiếp văn bản sạch sang `TextInputService` (`ZaloModule`) để thực thi Tool Calling**
      - Đảm bảo `ZcaBotFeatureService` chỉ làm nhiệm vụ tiếp nhận, trích xuất text/media, áp dụng guard/cooldown, sau đó ủy quyền thực thi tool cho `TextInputService`.

- [x] **Step 4: Chạy unit test kiểm thử toàn diện cho `ZcaBotFeatureService`**
      - Chạy `npm test apps/api/src/zca/zca-bot-feature.service.spec.ts`.

---

### Task 5: Tinh Gọn `ZaloModule` Chỉ Còn Tầng Tool Calling & Strategies

**Files:**
- Modify: `apps/api/src/zalo/zalo.module.ts`
- Modify: `apps/api/src/zalo/text/text-input.service.ts`
- Modify: `apps/api/src/zalo/zalo.service.ts` (thu gọn hoặc chuyển vai trò uỷ quyền)
- Test: `apps/api/src/zalo/text/text-input.service.spec.ts`
- Test: `apps/api/src/zalo/text/text-tool.factory.spec.ts`

**Interfaces:**
- `TextInputService.process(input: AgentInput, toolTypeOverride?: TextToolType): Promise<void>`
- `TextToolFactory.getStrategy(type: TextToolType): TextToolStrategy`

- [ ] **Step 1: Dọn dẹp `ZaloModule`**
      - Bỏ các providers đã chuyển sang `ZcaModule`: `PendingImageActionService`, `PendingImageActionDispatcher`, `ImageBatchHandler`, `TransactionConfirmationService`, `InitialAdminBootstrapGuard`, `GrantAccessGuard`.
      - Import `ZcaModule` vào `ZaloModule` để sử dụng `TransactionConfirmationService` và `ZcaService`.

- [ ] **Step 2: Tinh gọn `TextInputService`**
      - Tập trung vào: Fast-path command routing, LLM tool calling resolution (`ZALO_TOOL_DEFINITIONS`), và thực thi Strategy tương ứng.
      - Chuyển `pendingImageDispatcher` sang `ZcaModule` xử lý ở tầng tiếp nhận sự kiện ZCA.

- [ ] **Step 3: Rà soát `ZaloService` và `ZaloController`**
      - Đơn giản hóa `ZaloService` để delegate thẳng qua `ZcaService` khi gửi tin hoặc thu hồi tin nhắn.
      - Giữ `ZaloController` ở mức tối giản (webhook forwarder) hoặc đánh dấu deprecated.

---

### Task 6: Kiểm Thử Tích Hợp Toàn Hệ Thống (End-to-End Unit & Integration Verification)

**Files:**
- All test files in `apps/api/src/zalo/**/*.spec.ts` and `apps/api/src/zca/**/*.spec.ts`
- `apps/api/src/app.module.ts`

- [ ] **Step 1: Sửa chữa các import bị gãy trong toàn bộ codebase**
      - Quét và cập nhật lại đường dẫn import của `TransactionConfirmationService`, `PendingImageActionService`, `guards` trên toàn bộ các file test.

- [ ] **Step 2: Chạy kiểm thử tự động toàn bộ ứng dụng**
      - Chạy `npm test` để xác nhận tất cả 264+ test cases của `apps/api` và `apps/web` đều pass 100%.

- [ ] **Step 3: Kiểm tra Build dự án**
      - Chạy `npm run build` để đảm bảo TypeScript biên dịch thành công không có lỗi type.
