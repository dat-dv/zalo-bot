# Walkthrough: Sổ chung + Người tạo + Ảnh hoá đơn (2026-10-20)

## Kết quả
- **Sổ chung**: `users.is_ledger_owner` + `LedgerService`. Khi có chủ sổ, mọi dữ liệu tài chính từ chat Zalo (8 strategy + nhánh commit của `TransactionConfirmationService`) và dashboard (`FinanceController`, phần tài chính của `ReportsController`) đều ghi/đọc sổ của chủ sổ. Chưa có chủ sổ → hành vi cũ.
- **Admin**: `GET /api/finance/ledger`, `PATCH /api/finance/ledger/owner`, `POST /api/finance/ledger/consolidate`. UI khối "Sổ thu chi chung" + hộp thoại gộp trên trang Zalo & Users, badge "Chủ sổ".
- **Gộp dữ liệu cũ**: một transaction DB, ghi lại người tạo trước khi chuyển, khử trùng nơi chốn/người liên quan/danh mục, ghi audit log, không xoá tài khoản. Logic chuyển tách thành `finance-data-mover.ts`, `UserMergeService` dùng lại (test gộp tài khoản vẫn pass).
- **Người tạo**: cột mới `created_by_user_id`, `created_by_name`, `source`, `source_chat_id`; DTO trả `createdByName` (tên hiện tại, fallback tên lúc tạo), `sourceChatName/Type`, `hasReceipt`.
- **Ảnh hoá đơn**: `GET /api/transactions/:id/receipt` (Bearer hoặc cookie, chỉ sổ của người xem, Drive bằng token người tạo, CDN Zalo theo allowlist host, ≤10MB, chỉ `image/*`).
- **Web Thu chi**: cột Người tạo (tên + nguồn), cột Ảnh (thumbnail → lightbox), mọi dòng mở rộng được với khối chi tiết đầy đủ + ảnh lớn + phân bổ.
- Migration mới: `1724780000000-AddSharedLedgerAndTransactionCreator` (chạy tự động khi API khởi động, `migrationsRun: true`).

## Khác so với plan
- Endpoint đặt chủ sổ là `PATCH /api/finance/ledger/owner` (nằm ở FinanceController) thay vì `PATCH /api/users/:id/ledger-owner`, để logic sổ ở một chỗ.
- Ảnh tải bằng `<img src>` xác thực qua cookie refresh (helper có sẵn `getDashboardUserIdFromBrowser`, giống link Drive/Photos hiện có) thay vì tải blob qua `httpClient`.
- Cột Người tạo không tự ẩn trên màn hình < 640px (DataTable chỉ hỗ trợ ẩn mặc định tĩnh); người dùng tắt được qua cài đặt cột, thông tin vẫn có trong dòng mở rộng.
- Thông báo lỗi trong khối Sổ chung hiển thị thông điệp từ backend (đã là tiếng Việt) thay vì khoá i18n riêng.

## Xác minh
- `npm run typecheck`: pass (contracts, api, web).
- `npm run test`: API 385/385, web 26/26 (mới: `finance/shared-ledger.spec.ts` 9 test; `users/api/users-api.spec.ts` 3 test).
- ESLint các file đã sửa: pass. 27 lỗi còn lại trong `transaction-confirmation.service.ts` đều có từ trước (vùng `rawMessenger: any`), không nằm trên dòng đã sửa.
- `npm run build --workspace @zalobot/web`: pass.
- `node .claude/hooks/docs-drift-check.mjs --all`: PASS.
- **Chưa chạy migration trên DB thật và chưa kiểm tra thủ công trên app** (chưa mở UI trên trình duyệt; giao diện mobile/dark mode chưa xem trực tiếp).

## Vận hành sau deploy (anh làm trên prod)
1. Sao lưu DB: `docker exec <postgres> pg_dump -U zalobot zalobot > backup-$(date +%F).sql`.
2. Trang Zalo & Users → khối "Sổ thu chi chung" → chọn **Văn Đạt** → "Đặt làm chủ sổ".
3. "Gộp dữ liệu cũ vào sổ chung" → kiểm tra số lượng từng sổ → "Xác nhận gộp".
4. Kiểm tra trang Thu chi: giao dịch của Diệu Hằng hiện với người tạo "Diệu Hằng".

## Lưu ý
- Working tree có thay đổi không thuộc task này (`money-visibility-provider.tsx`, `expenses-screen.tsx`, 1 dòng trong docs `web-ui-direction`/`dashboard`/`expenses`) — không đưa vào commit của task.
- Giả định: host CDN ảnh Zalo kết thúc bằng `.zadn.vn`, `.zdn.vn`, `.zalo.me`, `.zaloapp.com`. Nếu ảnh cũ dùng host khác sẽ hiện "Không tải được ảnh".
