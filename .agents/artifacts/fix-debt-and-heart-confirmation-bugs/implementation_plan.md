# Kế hoạch: Sửa 3 lỗi chức năng (Trả nhanh, MANAGE_DEBT, requiredHearts) + gắn `financeTransactionId`

- Route: `implement` · Authority hiện tại: `inspect-and-plan` (Phase 1)
- Mức rủi ro: **MEDIUM** (nhiều file, đổi hành vi xác nhận và ghi nợ; không đổi schema DB)
- Nguồn lỗi: mục "Lỗi/khoảng trống code" trong `.agents/artifacts/sync-docs-with-code-2026-10/walkthrough.md` (nằm ở commit `cfe8047` trên `main`).

## 0. Chuẩn bị

- Nhánh `claude/hungry-feynman-b9d4da` đang ở `fcd727a`, **chưa có** commit đồng bộ docs `cfe8047` của `main` (chứa các ghi chú "known issue" cần xoá). Bước đầu Phase 2: đồng bộ nhánh với `main` (`sync_with_base_branch`), rồi mới sửa code/docs.

## 1. Trả nhanh (Quick Repay) bị 404

**Nguyên nhân**: `API_ROUTES.debtPayments = '/api/debts/payments'` (`packages/contracts/src/index.ts:13`), nhưng backend chỉ có `POST debts/:id/payments` (`apps/api/src/finance/finance.controller.ts:548`).

**Sửa**:
- `packages/contracts/src/index.ts`: thay `debtPayments: '/api/debts/payments'` bằng route động
  `debtPayments: (debtId: string) => \`/api/debts/${debtId}/payments\``, và thêm
  `debtPaymentDetail: (debtId: string, paymentId: string) => \`/api/debts/${debtId}/payments/${paymentId}\``.
  (Đã grep: `debtPayments` chỉ được dùng ở `debts-api.ts`.)
- `apps/web/src/modules/debts/api/debts-api.ts`:
  - `createDebtPayment`: tách `debtId` khỏi body, `POST API_ROUTES.debtPayments(debtId)` với `{ amount, paymentDate, note }`.
  - Response backend là `{ debt, payment }`, không phải `IDebtPaymentItem` → đọc `response.data.data.payment` để kiểu trả về đúng thật (hook chỉ invalidate cache, không dùng kết quả).
  - `deleteDebtPayment` và `updateDebt` đang ghép chuỗi `${API_ROUTES.debts}/${id}` → chuyển `deleteDebtPayment` sang `API_ROUTES.debtPaymentDetail(...)` (đúng rule no-hardcoded-routes). `updateDebt` để nguyên (ngoài phạm vi, không hỏng).

## 2. `MANAGE_DEBT` từ chat bị từ chối khi duyệt

**Nguyên nhân**: `ManageDebtToolStrategy` (`apps/api/src/zalo/text/strategies/manage-debt-tool.strategy.ts`) tạo payload không có `contactId`/`createNewContact`, nên `FinanceService.createDebt` ném "Cần chọn người trong danh bạ hoặc xác nhận tạo người mới."

**Sửa** (trong strategy, trước khi tạo thẻ chờ, để thẻ hiển thị đúng người):
- Inject `FinanceService` (`@Optional()`, giống `record-transaction-tool.strategy.ts`).
- Gọi `financeService.resolveContacts(senderId, counterparty)` (so khớp chính xác tên chuẩn hoá, đúng thuật ngữ "Danh bạ công nợ" trong `CONTEXT.md`):
  - **1 kết quả** → `contactId = contact.id`, `counterparty = contact.displayName`, `counterpartyAlias = contact.alias`.
  - **0 kết quả** → `createNewContact: true` (người mới được tạo khi duyệt).
  - **>1 kết quả** (trùng tên) → không tạo thẻ; gửi tin liệt kê các biệt danh, ví dụ `Trí (Trí Đen)`, và nhờ người dùng nhắn lại kèm biệt danh. Nếu tool args có `counterpartyAlias` thì truyền vào `resolveContacts` để thu hẹp.
- Card: hiển thị dòng người liên quan; `createNewContact` hiện đang `hidden` trong `DEBT_DESCRIPTOR` → giữ hidden, nhưng thêm hậu tố "(người mới)" vào counterparty hiển thị? → **Không**, giữ tối giản: không đổi descriptor.

## 3. `requiredHearts` của kênh không được áp dụng

**Nguyên nhân**: `createPendingAction` (`transaction-confirmation.service.ts:321`) dùng `params.requiredHearts ?? 1`, và không caller nào truyền giá trị → luôn 1 tim, kể cả nhóm (mặc định 5).

**Sửa** (tập trung một chỗ để mọi loại thẻ đều đúng):
- `ThreadConfigService`: thêm `findStoredConfig(threadId)` public, chỉ đọc (bọc `loadStoredConfig` hiện có; **không** tạo config mặc định — tránh sinh bản ghi rác cho chat webhook chính thức như `getConfig` sẽ làm).
- `TransactionConfirmationService`: inject `@Optional() ThreadConfigService` (cùng `zca.module`, không vòng phụ thuộc). Trong `createPendingAction`: nếu `params.requiredHearts` không có → đọc config đã lưu của `chatId`; dùng `confirmationRules.requiredHearts` (ép số nguyên ≥ 1); không có config → 1.
- Thông điệp thẻ đã tự hiển thị "Thả tim (❤️) N lần" khi N > 1 và luồng reaction đã đếm theo `pending.requiredHearts` → không cần sửa thêm.

## 4. (Tuỳ chọn, đề xuất làm) Đợt trả không gắn `financeTransactionId`

**Nguyên nhân**: `FinanceService.recordDebtPayment` (`finance.service.ts:1494`) lưu payment trước rồi lưu giao dịch _Thu hồi nợ_/_Trả nợ_ mà không liên kết → xoá đợt trả để lại giao dịch mồ côi (`deleteDebtPayment` chỉ xoá giao dịch khi có `financeTransactionId`).

**Sửa**: trong cùng transaction, lưu giao dịch trước, sau đó tạo payment với `financeTransactionId: tx.id`. Không đổi schema (cột đã tồn tại). Dữ liệu cũ không được backfill (ghi rõ trong docs).

## 5. Test hồi quy

- `apps/api/src/finance/finance.service.spec.ts`: `recordDebtPayment` gắn `financeTransactionId` = id giao dịch tự sinh; `deleteDebtPayment` xoá giao dịch đó.
- `apps/api/src/zalo/text/strategies/manage-debt-tool.strategy.spec.ts` (mới): 1 kết quả → `contactId`; 0 → `createNewContact: true`; >1 → không gọi `createPendingDebt`, gửi tin hỏi biệt danh.
- `apps/api/src/zca/confirmation/transaction-confirmation.service.spec.ts`: thread config nhóm có `requiredHearts: 5` → pending có `requiredHearts === 5`; không có config → 1; tham số tường minh vẫn được ưu tiên.
- `apps/api/src/zca/thread-config.service.spec.ts`: `findStoredConfig` trả `undefined` và không tạo bản ghi khi kênh chưa có config.
- Contracts/web: `API_ROUTES.debtPayments('abc') === '/api/debts/abc/payments'` (thêm vào test contracts nếu workspace có test runner; nếu không, dựa vào typecheck và ghi rõ).

## 6. Kiểm tra

`npm run typecheck`, `npm run lint`, `npm run test` (toàn monorepo), `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## 7. Tài liệu (Hard Completion Gate)

Xoá các ghi chú "known issue" tương ứng và mô tả hành vi mới (EN + VI):
- `.agents/knowledge/modules/debts/README.md` + `.agents/docs/modules/debts/README.md`: route `API_ROUTES.debtPayments(debtId)`; đợt trả thủ công nay gắn `financeTransactionId`, xoá đợt trả xoá luôn giao dịch tự sinh (dữ liệu cũ không backfill).
- `.agents/knowledge/modules/zca/README.md` + `.agents/docs/modules/zca/README.md`: thẻ chờ lấy `requiredHearts` từ config kênh đã lưu; luồng `MANAGE_DEBT` resolve danh bạ.
- Tài liệu global finance-domain (EN + VI) mà `cfe8047` đã thêm: bỏ mục lỗi 4–7 (đường dẫn chính xác xác định sau khi sync nhánh).
- `.agents/docs/README.md` chỉ cập nhật nếu thêm/bớt file.
- Ghi `walkthrough.md` cho task này trong cùng thư mục artifact.

## Ngoài phạm vi (ghi nhận, không sửa)

- `rawMessenger: any` sẵn có trong constructor `TransactionConfirmationService` (vi phạm zero-any có từ trước).
- Card vẫn ghi "Thả tim" kể cả khi kênh tắt `allowReactions`.
- `updateDebt` ghép chuỗi route thủ công.

## Commit

Một commit trên nhánh hiện tại sau khi mọi kiểm tra pass; không push/PR trừ khi được yêu cầu.
