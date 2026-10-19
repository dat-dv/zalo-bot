# Walkthrough: Sửa Trả nhanh, MANAGE_DEBT, requiredHearts, liên kết đợt trả

Kế hoạch đã duyệt: [implementation_plan.md](implementation_plan.md). Nhánh đã fast-forward lên `main` local (gồm `cfe8047` đồng bộ docs) trước khi sửa.

## Thay đổi

1. **Trả nhanh 404**
   - `packages/contracts/src/index.ts`: `API_ROUTES.debtPayments(debtId)` → `/api/debts/:id/payments`; thêm `API_ROUTES.debtPaymentDetail(debtId, paymentId)`.
   - `apps/web/src/modules/debts/api/debts-api.ts`: `createDebtPayment` đưa `debtId` lên đường dẫn, body chỉ còn `amount/paymentDate/note`, trả về phần `payment` của response `{ debt, payment }`; `deleteDebtPayment` dùng `debtPaymentDetail`.
2. **MANAGE_DEBT bị từ chối khi duyệt**
   - `manage-debt-tool.strategy.ts`: inject `FinanceService`, gọi `resolveContacts` → 1 người: `contactId`; 0 người: `createNewContact: true`; nhiều người: không tạo thẻ, liệt kê `Tên (biệt danh)`.
   - `text-tool.definitions.ts`: thêm tham số tuỳ chọn `counterpartyAlias` cho tool.
3. **requiredHearts không áp dụng**
   - `thread-config.service.ts`: thêm `findStoredConfig` (chỉ đọc, không tạo config).
   - `transaction-confirmation.service.ts`: inject `@Optional() ThreadConfigService`; `createPendingAction` lấy `confirmationRules.requiredHearts` khi không truyền tường minh, mặc định 1.
4. **Liên kết `financeTransactionId`**
   - `finance.service.ts` `recordDebtPayment`: lưu giao dịch thu–chi trước, rồi tạo đợt trả với `financeTransactionId`. Dữ liệu cũ không backfill.

## Test hồi quy

- `apps/web/src/modules/debts/api/debts-api.spec.ts` (mới): URL + body của tạo/xoá đợt trả.
- `apps/api/src/zalo/text/strategies/manage-debt-tool.strategy.spec.ts` (mới): 1 / 0 / nhiều kết quả, truyền biệt danh.
- `transaction-confirmation.service.spec.ts`: config nhóm 5 tim, giá trị tường minh thắng, chat chưa có config → 1 và không sinh config.
- `finance.service.spec.ts`: đợt trả gắn `financeTransactionId`; xoá đợt trả xoá giao dịch liên kết.
- Cập nhật mock `resolveContacts` trong `text-input.service.spec.ts`, `input-processor.service.spec.ts`.

## Kiểm tra

- `npm run typecheck`: pass.
- `npm run test`: pass (api 335/335, web 22/22).
- `npm run lint`: **fail do lỗi có sẵn** (api 108 lỗi, contracts 62 lỗi ở các file/dòng không liên quan). So sánh từng file đã sửa với `HEAD`: không phát sinh lỗi mới (số lỗi bằng hoặc ít hơn); thư mục `apps/web/src/modules/debts/api` lint sạch.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Tài liệu

Đã xoá ghi chú "lỗi đã biết" và mô tả hành vi mới (EN + VI): `modules/debts`, `modules/zca`, `global/finance-domain`, `global/zalo-response-layout`.

## Còn lại (ngoài phạm vi)

- `rawMessenger: any` sẵn có trong constructor `TransactionConfirmationService`.
- Thẻ vẫn ghi "Thả tim" kể cả khi kênh tắt `allowReactions`.
- Lỗi lint có sẵn ở api/contracts.
