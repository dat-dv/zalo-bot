# Kế hoạch: Thu gọn nút tab / filter / điều hướng trên điện thoại

- Route: `implement` · Phase 1 (Planning) · Risk: **MEDIUM** (nhiều file UI, đổi một quy ước giao diện đã ghi trong knowledge)
- Phạm vi: `apps/web` (chỉ class Tailwind ở khổ ≤ 640px). Desktop không đổi.

## 1. Hiện trạng (đã xem trên prod ở 375×812)

Quy ước hiện tại (`global/web-ui-direction.md`): *"ở khổ điện thoại mọi control chạm được đều ≥ 40px"*. Quy ước này áp cả cho các control dạng **chip/tab/filter trên toolbar**, nên trên điện thoại chúng to hơn cần thiết:

| Vị trí | Hiện tại (≤ 640px) |
| --- | --- |
| `PeriodFilterToolbar`: ô chọn Tuần/Tháng…, nút ‹ › | 40px |
| Chip lọc Thu chi (Tất cả / Thu / Chi / Cân chỉnh số dư / Xoá lọc) | 40px, chữ 12.5px |
| Debts: 2 hàng 3 nút (Trạng thái, Chiều nợ) | 40px |
| Tasks, Contacts, Places, Settings (tab), ZCA (tab lọc, sort, phân trang), Analytics (Biểu đồ/Bảng) | 40px |
| Nút phễu lọc cột trên header danh sách (LOẠI / DANH MỤC / GHI CHÚ…) | 40×40 |
| Ô tìm kiếm trên toolbar | 40px |
| Icon topbar mobile (ẩn số tiền, làm mới) | 40×40 |

Mỗi màn tự khai báo `max-[640px]:h-10 …` (có 3 bản sao `PHONE_CHIP` cục bộ: debts, settings, tasks/analytics dùng biến khác tên).

## 2. Đề xuất

Tách 2 tầng kích thước cho điện thoại:

- **Tầng toolbar (mới, gọn hơn)** — chip lọc, tab, segmented control, nút ‹ ›, nút phễu cột, nút phân trang, chip hành động trên toolbar:
  - Chip / tab: **32px** (`h-8`), padding ngang 10px, chữ **12px**.
  - Nút icon (‹ ›, phễu, ✕ xoá tìm kiếm): **32×32**.
  - Ô tìm kiếm & select trên toolbar: **36px** (`h-9`). Cỡ chữ 16px trên màn cảm ứng **giữ nguyên** (chống iOS tự zoom khi focus).
  - Icon topbar mobile: **36×36**.
- **Tầng thao tác (giữ 40px như cũ)** — nút trong dialog / bottom-sheet / footer, ô nhập trong form, ô sửa inline, dòng danh sách, `MobileActionBar`, thanh tab đáy (56px), More sheet.

Lý do giữ khoảng cách an toàn: 32px vẫn vượt mức tối thiểu WCAG 2.5.8 (24px); khoảng cách giữa các chip giữ ≥ 6px để tránh bấm nhầm.

### Hằng số dùng chung (`apps/web/src/shared/ui/touch.ts`)

```ts
/** Toolbar chips, tabs and segmented buttons at phone width: 32px, compact text. */
export const PHONE_CHIP = 'max-[640px]:h-8 max-[640px]:min-h-8 max-[640px]:px-2.5 max-[640px]:text-[12px]';
/** Icon-only toolbar buttons at phone width (‹ ›, column filter, clear search): 32×32. */
export const PHONE_ICON_CHIP = 'max-[640px]:size-8 max-[640px]:min-h-8';
/** Toolbar search inputs and selects at phone width: 36px, full width. */
export const PHONE_TOOLBAR_INPUT = 'max-[640px]:h-9 max-[640px]:min-h-9 max-[640px]:w-full';
```

`TAP_CONTROL` / `TAP_INPUT` (40px) giữ nguyên cho tầng thao tác. Bỏ các bản sao `PHONE_CHIP` cục bộ, import từ `touch.ts`.

## 3. Danh sách file thay đổi

| File | Thay đổi |
| --- | --- |
| `shared/ui/touch.ts` | Thêm 3 hằng số trên (+ comment) |
| `shared/ui/period-filter-toolbar.tsx` | Select `h-10` → 36px; ‹ › `size-10` → 32px; segmented (khi hiện) theo `PHONE_CHIP` |
| `shared/ui/app-navigation.tsx` | `TOPBAR_ICON_BUTTON` `size-10` → `size-9` |
| `modules/dashboard/presentation/components/column-filter-popover.tsx` | Nút phễu `max-[640px]:size-10` → `PHONE_ICON_CHIP`. Nội dung panel (checkbox, ô nhập, nút Xoá) giữ 40px |
| `modules/dashboard/presentation/components/transactions-screen.tsx` | 5 chip toolbar → `PHONE_CHIP`; ô tìm kiếm → `PHONE_TOOLBAR_INPUT`. Nút "Tải thêm" giữ 40px |
| `modules/debts/presentation/components/debts-screen.tsx` | `PHONE_CHIP` cục bộ → shared (vẫn giữ lưới 3 cột); ô tìm kiếm → `PHONE_TOOLBAR_INPUT` |
| `modules/dashboard/presentation/components/tasks-screen.tsx` | Chip trạng thái → `PHONE_CHIP`; ô tìm kiếm → 36px |
| `modules/dashboard/presentation/components/reminders-screen.tsx` | Ô tìm kiếm → 36px |
| `modules/contacts/presentation/components/contacts-screen.tsx` | Chip toolbar (Đồng bộ/Gộp/Chọn tất cả…) → `PHONE_CHIP`; ô tìm kiếm → 36px; ✕ gợi ý → 32px |
| `modules/dashboard/presentation/components/places-screen.tsx` | Chip toolbar → `PHONE_CHIP`; ô tìm kiếm → 36px. Form thêm nhanh giữ 40px |
| `modules/settings/presentation/components/settings-screen.tsx` | Tab + chip → shared `PHONE_CHIP`; ô tìm kiếm → 36px. Hàng thêm nhanh giữ 40px |
| `modules/zca/view/zca-screen.tsx` | Tab lọc, select sắp xếp, chip Đồng bộ/Kho Drive, phân trang ‹ › → tầng toolbar; ô tìm kiếm + ✕ → 36px/32px. Nút trong banner cảnh báo giữ 40px |
| `modules/dashboard/presentation/components/analytics-screen.tsx` | Toggle Biểu đồ/Bảng → 32px (vẫn chia đôi hàng) |
| `modules/dashboard/presentation/components/calendar-screen.tsx` | Kiểm tra toolbar phone (‹ tháng ›, Hôm nay, icon tìm, segmented Agenda/Tháng) và đưa về cùng tầng toolbar nếu đang 40px |

**Không đổi**: thanh tab đáy, More sheet, quick links trang Tổng quan (ô lưới 2 dòng chữ), dialog/sheet/form, ô sửa inline trong bảng, `MobileActionBar`.

## 4. Tài liệu (Hard Completion Gate)

- `.agents/knowledge/global/web-ui-direction.md` (EN) + `.agents/docs/global/web-ui-direction.md` (VI): thay quy ước "mọi control ≥ 40px" bằng 2 tầng (toolbar 32/36px vs thao tác 40px), mô tả 3 hằng số mới.
- Cập nhật các dòng nhắc "chip 40px / search 40px" ở knowledge + docs của: `modules/dashboard`, `modules/debts`, `modules/contacts`, `modules/zca`, `modules/settings`.
- Chạy `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## 5. Kiểm tra

1. `npm run typecheck --workspace @zalobot/web`, `npm run lint --workspace @zalobot/web`, `npm run test --workspace @zalobot/web`.
2. `npm run build --workspace @zalobot/web` (static export).
3. Xem trực quan ở 375px và 390px trong browser pane (dev server local): Thu chi, Công nợ, Việc cần làm, Người liên quan, Nơi chốn, Cài đặt, Zalo & Người dùng, Phân tích, Lịch — chip không rớt dòng bất thường, hàng cuộn ngang vẫn cuộn, desktop (≥ 641px) không đổi.
4. Prod chỉ thấy thay đổi sau khi deploy; không đụng phiên đăng nhập prod trong browser pane.

## 6. Câu hỏi mở (trả lời khi duyệt, nếu muốn khác mặc định)

1. Mức thu nhỏ: chip **32px** / ô tìm kiếm **36px** — hay muốn gọn hơn nữa (28/32px)?
2. Thanh tab đáy (56px) và icon topbar: plan chỉ thu icon topbar xuống 36px, **giữ** thanh tab đáy. Có muốn thu thanh tab đáy luôn (vd. 52px) không?
