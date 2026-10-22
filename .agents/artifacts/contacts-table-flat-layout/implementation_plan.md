# Kế hoạch: Làm phẳng bảng "Danh bạ công nợ" (`/contacts`)

Tiếp nối task `zca-table-flat-layout` (commit `c517b91`): cùng nguyên tắc, áp cho bảng contacts.

## 1. Vấn đề hiện tại

File: `apps/web/src/modules/contacts/presentation/components/contacts-screen.tsx` (định nghĩa cột, dòng ~252–590). Bảng dùng `DataTable` chung (`shared/ui/data-table.tsx`). Ô `<td>` của `DataTable` **không có `whitespace-nowrap`**, nên chữ dài và cụm chip tự xuống dòng.

| Cột | Hiện tại | Vấn đề |
| --- | --- | --- |
| Số điện thoại | Số + chip vàng nền `bg-amber-50` "Zalo: 09…" khi số khác số của user | Chip nền màu; ô có chip thường xuống dòng |
| Tài khoản liên kết | Chip nền xanh `bg-sky-50` + emoji `👤` + `Tên (@username)` | Chip + emoji, tên dài thì xuống dòng |
| Tài nguyên | 2 chip `bg-amber-100` "N nợ" và `bg-slate-100` "N giao dịch" trong `flex-wrap` | Chip màu; `flex-wrap` đẩy chip thứ 2 xuống dòng |
| Tên / Biệt danh / Mô tả / Ngân hàng | Chữ thường, không chặn wrap | Mô tả hoặc tên dài thì làm hàng cao 2–3 dòng |
| Thao tác | `✎ Sửa`, `✓ Lưu` | Emoji trong nút (bảng `/zca` đã bỏ) |

## 2. Thay đổi (chỉ `contacts-screen.tsx`)

1. **Mọi ô một dòng**: chữ hiển thị (không phải lúc đang sửa) bọc trong `span` dạng `block truncate whitespace-nowrap` với `title` = giá trị đầy đủ, để hover vẫn đọc được. Giới hạn rộng theo cột: Tên `max-w-[220px]`, Biệt danh `max-w-[160px]`, Mô tả `max-w-[260px]`, Ngân hàng `max-w-[140px]`, Tài khoản liên kết `max-w-[200px]`. Ô input lúc đang sửa giữ nguyên.
2. **Số điện thoại**: bỏ chip vàng. Hiện `09… · Zalo: 08…`, phần "Zalo: …" là chữ `text-[11px] text-amber-700` không nền (vẫn giữ màu vàng để báo hai số lệch nhau), giữ `title` giải thích như cũ.
3. **Tài khoản liên kết**: bỏ chip xanh và `👤`. Hiện `Tên` (chữ thường `text-slate-700`) + ` @username` (chữ mờ `text-slate-500`); không có tên thì chỉ `@username`. Trường hợp `#<id>` giữ nguyên.
4. **Tài nguyên**: bỏ 2 chip và `flex-wrap`. Hiện một dòng `3 nợ · 12 giao dịch`, dùng lại các khóa i18n hiện có `contacts.combineModal.debtsBadge` / `transactionsBadge`. Số nợ để chữ `text-amber-700` (nợ là thứ cần chú ý), số giao dịch để chữ xám. Chỉ hiện phần nào > 0; cả hai bằng 0 thì `0` như cũ.
5. **Thao tác**: bỏ emoji `✎` / `✓` trong nút Sửa/Lưu. Nút `✕` (huỷ) giữ nguyên vì là ký hiệu icon. Kiểu nút vuông `h-[22px] rounded-[2px]` đã đúng, không đổi.

## 3. Không đổi

- `DataTable` dùng chung (không thêm `whitespace-nowrap` toàn cục, tránh ảnh hưởng các bảng khác).
- Logic sửa trực tiếp, gộp danh bạ, tìm kiếm, thanh công cụ (chip "đã chọn N" nằm ngoài bảng), hộp thoại gộp `combine-contacts-dialog.tsx`, danh sách mobile.
- API, contracts, i18n.

## 4. Tài liệu

- `.agents/knowledge/modules/contacts/README.md` dòng ~23: `linkedUser` ("badge" → plain text `firstName @username`), `resources` ("count badges" → một dòng chữ `N nợ · N giao dịch`), thêm ý: các ô một dòng, cắt bớt, `title` có giá trị đầy đủ. Dòng ~49/phần phone backup: chip → chữ vàng "Zalo: <số>".
- `.agents/docs/modules/contacts/README.md` dòng ~39 và ~60: bản tiếng Việt tương ứng (bỏ "badge", "chip vàng").
- `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## 5. Kiểm tra

- `npm run typecheck`, `npm run lint`, `npm run test` của `@zalobot/web`.
- Xem bằng mắt: máy chưa chạy Postgres/Redis của dự án nên có thể không dựng được trang; nếu vậy sẽ ghi rõ là chưa xem.
- Commit riêng các file của task này (working tree đang có thay đổi của task `channel-storage-link-edit-delete`), push lên `main` khi anh yêu cầu.

## 6. Rủi ro

- **LOW–MEDIUM**: 1 file code + 2 file tài liệu, chỉ đổi hiển thị.
- Chữ dài bị cắt (`…`); xem đầy đủ khi hover hoặc khi nhấp đúp để sửa.
