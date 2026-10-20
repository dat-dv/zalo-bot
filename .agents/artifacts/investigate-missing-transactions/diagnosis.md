# Chẩn đoán: Trang Transactions hiển thị thiếu giao dịch

## Hiện tượng
Trang `/transactions` không hiển thị đủ giao dịch anh đã ghi.

## Cách API lọc (bằng chứng code)
- `GET transactions` → `FinanceService.queryTransactions(ledgerUserId, query)` (`apps/api/src/finance/finance.service.ts:659`).
- Điều kiện cứng: `finance_transactions.user_id = ledgerUserId`, với `ledgerUserId = chủ sổ (users.is_ledger_owner = true)` nếu đã chọn, ngược lại = chính người đăng nhập (`ledger.service.ts` `resolveLedgerUserId`).
- Lọc thêm theo `occurred_at` trong kỳ (`startAt`/`endAt` từ bộ lọc kỳ, trừ khi chọn "all"), `type`, `search`, phân trang `limit/offset`.
- `LedgerService.cachedOwnerId` cache chủ sổ trong RAM process — chỉ cập nhật khi `setOwner` chạy trên chính process đó.

## Giả thuyết (xếp theo khả năng)
1. **Giao dịch nằm dưới `user_id` khác chủ sổ**: đã chọn chủ sổ nhưng chưa chạy "Gộp sổ" (consolidate), hoặc giao dịch ghi bởi ID Zalo trùng (webhook hex vs ZCA số) trước khi có chủ sổ.
2. **Cache chủ sổ lệch**: process API chưa restart/khác instance → vẫn ghi/đọc theo sổ riêng.
3. **`occurred_at` ngoài kỳ đang lọc**: LLM điền ngày sai/năm sai, hoặc lệch múi giờ ở biên đầu/cuối tháng.
4. **Bị xoá**: kiểm tra `audit_logs` action `remove`.

## Bảng logs
Có: `audit_logs` (`table_name, record_id, action[insert|update|remove], actor_id, before_data, after_data, created_at`). Ghi tự động bởi `AuditLogSubscriber` cho mọi insert/update/remove qua TypeORM. Lưu ý: `before_data/after_data` là `simple-json` (cột text) → cần `::jsonb`; `actor_id` = `userId` của bản ghi (chủ sổ), không phải người gửi.

## Query chẩn đoán
Xem trong câu trả lời chat (giống nội dung bên dưới).

```sql
-- 1. Chủ sổ hiện tại
SELECT id, "firstName", is_ledger_owner FROM users WHERE is_ledger_owner;

-- 2. Giao dịch đang phân bố theo sổ nào
SELECT t.user_id, u."firstName", u.is_ledger_owner, count(*) AS n,
       min(t.occurred_at) AS first_at, max(t.occurred_at) AS last_at
FROM finance_transactions t LEFT JOIN users u ON u.id = t.user_id
GROUP BY 1,2,3 ORDER BY n DESC;

-- 3. Giao dịch ghi gần đây (dù sổ nào) — so với cái anh thấy trên web
SELECT id, user_id, created_by_user_id, created_by_name, source, type, amount, category, note,
       occurred_at, created_at
FROM finance_transactions ORDER BY created_at DESC LIMIT 50;

-- 4. occurred_at lệch xa created_at (LLM điền sai ngày → rơi khỏi kỳ)
SELECT id, user_id, amount, note, occurred_at, created_at, created_at - occurred_at AS lag
FROM finance_transactions
WHERE abs(extract(epoch FROM created_at - occurred_at)) > 3*86400
ORDER BY created_at DESC LIMIT 50;

-- 5. Giao dịch đã insert nhưng nay không còn (bị xoá)
SELECT a.record_id, a.created_at AS inserted_at,
       a.after_data::jsonb->>'amount' AS amount, a.after_data::jsonb->>'note' AS note,
       r.created_at AS removed_at
FROM audit_logs a
LEFT JOIN finance_transactions t ON t.id::text = a.record_id
LEFT JOIN audit_logs r ON r.record_id = a.record_id AND r.table_name = 'finance_transactions' AND r.action = 'remove'
WHERE a.table_name = 'finance_transactions' AND a.action = 'insert' AND t.id IS NULL
ORDER BY a.created_at DESC LIMIT 50;

-- 6. Lịch sử 1 giao dịch cụ thể
SELECT action, actor_id, before_data, after_data, created_at
FROM audit_logs WHERE table_name = 'finance_transactions' AND record_id = '<id>'
ORDER BY created_at;

-- 7. Lịch sử gộp sổ / đổi chủ sổ
SELECT created_at, actor_id, after_data FROM audit_logs
WHERE after_data LIKE '%consolidate-shared-ledger%'
   OR (table_name = 'users' AND after_data LIKE '%isLedgerOwner%')
ORDER BY created_at DESC LIMIT 20;
```

## Bước tiếp theo
Chờ kết quả query từ anh để chốt nguyên nhân gốc, rồi đề xuất fix (route `implement`, cần duyệt plan).

## Kết quả query (2026-10-20) & Kết luận
- Không có chủ sổ (`is_ledger_owner` 0 rows) → hệ thống chạy sổ riêng theo từng `user_id`.
- 19 giao dịch chia ra 5 sổ: `2285509137317769272` (9, không có dòng users), `2099328425338516056` Văn Đạt (5), `573462d8909179cf2080` (3, ID webhook), `5369142156728714489` Diệu Hằng (1), `effcda102859c1079848` (1, ID webhook, không có dòng users).
- Không có giao dịch bị xoá; không có lần gộp sổ nào; `created_by_*` đều NULL (dữ liệu trước khi deploy tính năng sổ chung).
- **Nguyên nhân gốc**: dữ liệu bị phân mảnh qua nhiều danh tính Zalo, còn dashboard chỉ đọc sổ của người đăng nhập (Văn Đạt → 5/19). Không phải lỗi code.
- **Khắc phục (vận hành, không sửa code)**: trang `/zca` → panel Sổ chung → chọn chủ sổ → Gộp sổ (consolidate). Có ghi audit `consolidate-shared-ledger`, giữ người tạo gốc ở `created_by_user_id`.
