# Kế hoạch: Làm phẳng bảng "Zalo & Người dùng" (`/zca`)

## 1. Vấn đề hiện tại

File chính: `apps/web/src/modules/zca/presentation/components/chat-table-row.tsx`, header bảng trong `apps/web/src/modules/zca/view/zca-screen.tsx` (dòng ~630–652).

| Ô | Hiện tại | Vì sao xấu / xuống dòng |
| --- | --- | --- |
| Loại | Chip nền màu + emoji (`👥 Nhóm`, `👤 Cá nhân`, `🆔 Người dùng`) | Chip màu không có ý nghĩa vận hành, lệch phong cách vuông/trung tính |
| Tên | Tên + chip `🏷️ Gợi nhớ: …` + chip `🔗 N` (flex-wrap) ; dòng phụ `📞`, `👥` (flex-wrap) | Chip gợi nhớ dài đẩy xuống dòng; dòng phụ wrap thành 3 dòng |
| Lắng nghe | Nút **pill `rounded-full`** + dưới nó một cụm chip màu `🤖 @Bot`, `🧠 Nhớ`, `📁 Drive`, `📸 Photos` (flex-wrap trong cột `w-40`) | Ô cao 2–3 dòng; pill bo tròn; Drive bị lặp với nút Drive ở cột thao tác |
| Quyền tương tác | Badge **pill `rounded-full`** xếp **chồng dọc** trên nút Cấp quyền/Thu hồi | Luôn 2 dòng |
| Thao tác | 3 nút (`⏳ Sao lưu` nền xanh, `Drive`, `⚙️ Cấu hình`) + `⋯` | Quá nhiều nút/dòng, trái chuẩn "1 primary + menu ⋯" |

## 2. Hướng thiết kế (theo `02-project-design-direction.md` + memory "keep small radius")

- Bỏ toàn bộ `rounded-full` và chip nền màu trong bảng; dùng **chữ + chấm trạng thái `●`**, màu chỉ ở chữ/chấm khi có nghĩa (xanh = đang nghe/đã cấp, vàng = chờ duyệt, tím = admin).
- Nút trong bảng dùng đúng kiểu nút vuông của bảng công nợ: `h-[22px] rounded-[2px] border px-1.5 text-[11px]`.
- Mỗi ô **một dòng** (`whitespace-nowrap` + `truncate`), riêng ô Tên tối đa 2 dòng (tên / dòng phụ). Mục tiêu chiều cao hàng ~44–52px.
- Bỏ emoji trong ô dữ liệu (giữ nguyên nhãn trong menu `⋯` — ngoài phạm vi).

## 3. Thay đổi cụ thể

### 3.1. `chat-table-row.tsx`

1. **Cột Loại**: chữ thường `text-[11px] text-slate-600`, không nền, không emoji: `Nhóm` / `Cá nhân` / `Người dùng` (giữ `title` tooltip cho `user-only`). Đổi `KIND_BADGE` → `KIND_LABEL` (chỉ label + title).
2. **Avatar**: `size-8`, bo `rounded-[3px]` (vuông) thay vì tròn; fallback chữ cái nền `slate-100` trung tính (không còn tím/xanh theo loại). Giữ chấm xanh "đã cấp quyền" ở góc.
3. **Cột Tên**:
   - Dòng 1 (nowrap): tên `truncate` + gợi nhớ dạng chữ mờ `(alias)` `truncate`, không chip.
   - Dòng 2 (nowrap, `truncate`, ngăn cách `·`): nhóm → `N thành viên`; cá nhân → `Zalo: …` · SĐT (mono, không `📞`) · `@username` · link chữ `N người liên quan` (`text-sky-700 hover:underline`, mở `LinkedContactsDialog`, thay cho chip `🔗 N`).
4. **Cột Lắng nghe** (chỉ còn trạng thái, 1 dòng): nút toggle vuông `h-[22px] rounded-[2px] border`, nội dung `● Đang nghe` (chữ + chấm xanh) / `○ Bỏ qua` (xám). Bỏ `ConfigBadges` khỏi cột này.
5. **Cột mới "Tính năng"** (thay cho cụm chip cũ, 1 dòng, chữ `text-[11px] text-slate-500`, ngăn cách `·`): `@Bot` (nhóm, tooltip tiền tố) / `Chat riêng` (1-1), `Nhớ`, `Sao lưu media` — chỉ hiển thị cái đang bật; không có gì thì `—`. Không còn nút Drive/Photos ở đây (chuyển vào menu, xem 3.1.7).
6. **Cột Quyền tương tác** (1 dòng, `flex-nowrap gap-2`): trạng thái chữ + chấm (`● Admin` tím, `● Đã cấp` xanh, `● Chờ duyệt` vàng, `○ Chưa cấp` xám) + nút vuông nhỏ `Cấp quyền` (viền xanh, kiểu nút "emerald" của bảng công nợ) / `Thu hồi` (viền xám, hover đỏ). Bỏ `ACCESS_BADGE` pill.
7. **Cột Thao tác**: chỉ còn nút chính `Cấu hình` (vuông, viền xám, không emoji) + `⋯`. Đưa vào menu `⋯` (đứng đầu, trước nhóm thao tác người dùng):
   - `Mở Google Drive` → `ThreadStorageLinksDialog` kind `drive`
   - `Mở Google Photos` → kind `photos` (trước đây chỉ có ở chip trong cột Lắng nghe — giữ được đường vào)
   - `Sao lưu media lịch sử` (chỉ nhóm) → `SyncMediaModal`
   → Hàng nhóm giờ cũng có menu `⋯` (trước đây menu rỗng với nhóm).

### 3.2. `zca-screen.tsx` (header bảng)

- Thêm `<th>` "Tính năng"; đặt lại độ rộng: Loại `w-20`, ID `w-40`, Lắng nghe `w-28`, Tính năng `w-40`, Quyền `w-48`, Thao tác `w-28`; `colSpan` của hàng loading/empty 6 → 7.
- Header giữ nguyên kiểu chữ hiện có (không đổi thanh lọc/tabs — ngoài phạm vi).

### 3.3. Không đổi

- Logic dữ liệu (`model/chat-rows.ts`), API, contracts, hành vi bật/tắt lắng nghe, cấp/thu hồi quyền, các dialog.
- Thanh tìm kiếm / tabs lọc / phân trang.

## 4. Tài liệu (Hard Completion Gate)

Hành vi nghiệp vụ không đổi, nhưng tài liệu đang mô tả UI cũ nên phải cập nhật:

- `.agents/knowledge/modules/zca/README.md` dòng ~160–161: mô tả cột mới (Lắng nghe = toggle; Tính năng; Quyền 1 dòng; Thao tác = Cấu hình + `⋯` chứa Drive/Photos/Sao lưu).
- `.agents/knowledge/modules/zca/channel-storage.md` dòng ~88: đường mở `ThreadStorageLinksDialog` từ bảng giờ là menu `⋯`.
- `.agents/knowledge/modules/zca/chat-memory.md` dòng ~48: "🧠 Nhớ" → chữ `Nhớ` trong cột Tính năng.
- `.agents/docs/modules/zca/channel-storage.md` dòng ~47 và `.agents/docs/modules/zca/README.md` (mục nút Sao lưu, bảng cột) — bản tiếng Việt tương ứng.
- Chạy `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## 5. Kiểm tra

- `npm run typecheck --workspace @zalobot/web`, `npm run lint --workspace @zalobot/web`, `npm run test --workspace @zalobot/web` (spec `chat-rows.spec.ts` không bị ảnh hưởng).
- Chạy dev, mở `/zca` trong browser pane: chụp màn hình desktop (≥1280px) kiểm tra mỗi hàng 1–2 dòng, không pill; kiểm tra light/dark; mở menu `⋯` của hàng nhóm và hàng cá nhân, bấm Drive/Photos/Sao lưu mở đúng dialog.

## 6. Rủi ro

- **MEDIUM**: 2 file code + 5 file tài liệu, thay đổi UI rõ rệt; không đụng API/DB.
- Drive/Photos/Sao lưu cần thêm 1 click (qua `⋯`) — đổi lại hàng gọn. Nếu anh muốn giữ Drive là nút nổi, có thể giữ `Drive` cạnh `Cấu hình` (cột Thao tác rộng thêm ~60px).
- Avatar vuông là thay đổi thẩm mỹ; nếu anh muốn giữ avatar tròn thì bỏ bước 3.1.2.
