# Implementation plan: Mobile UI giai đoạn A (thử trên màn Thu chi)

- Route: implement · Phase 1 (inspect-and-plan) · Rủi ro: **TRUNG BÌNH** (sửa component dùng chung, đổi hợp đồng UI trên mobile)
- Nguồn: [research.md](research.md)
- Quyết định đã chốt: bảng dạng danh sách trên mobile; **bỏ STT/ID trên mobile** (ID vẫn xem được trong bảng trượt); **giữ hamburger**; **giữ nguyên bo góc nhỏ hiện tại** (`rounded-[3px]` / `rounded` / `rounded-[2px]`), không thêm chip/nút bo tròn, không có FAB bo tròn.

## 1. Mục tiêu và phạm vi

| Hạng mục | Breakpoint | Phạm vi |
| --- | --- | --- |
| A1. DataTable chế độ danh sách (opt-in) | ≤ 640px | `shared/ui/data-table.tsx` + hook/helper mới; chỉ bật cho `TransactionsTable` |
| A2. Gộp header vào topbar mobile | ≤ 960px (trùng breakpoint của menu hiện tại) | `app-navigation.tsx`, `workspace-header.tsx` |
| A3. Vùng chạm ≥ 40px | ≤ 640px (topbar/drawer: ≤ 960px) | Topbar, drawer, danh sách, bảng trượt, toolbar Thu chi, `PeriodFilterToolbar`, nút lọc cột |

**Ngoài phạm vi (giai đoạn B/C):** chế độ danh sách cho các bảng khác, KPI/`TrendSummaryStrip`, Lịch, ZCA, Tổng quan, bottom tab bar, toast, prop `counter` của DataPanel chưa được render. Desktop (> 960px) **không đổi gì**.

## 2. Thiết kế chi tiết

### A1. DataTable: chế độ danh sách trên mobile

**Hợp đồng cột mới** (thêm vào `DataTableColumn<T>`, đều optional nên không ảnh hưởng bảng cũ):

```ts
mobileSlot?: 'primary' | 'secondary' | 'trailing';
mobileCell?: (row: T, index: number) => ReactNode; // bản hiển thị gọn; mặc định dùng cell()
mobileHeader?: boolean; // đưa header (vd. nút lọc cột) lên dải lọc của danh sách
```

- Chế độ danh sách **chỉ bật** khi có ít nhất một cột khai báo `mobileSlot` **và** viewport ≤ 640px. Các bảng chưa khai báo giữ nguyên bảng cuộn ngang như hiện tại.
- **Hook mới** `shared/hooks/use-media-query.ts`: dùng `useSyncExternalStore` + `matchMedia`; server snapshot = `false`. App là static export nên không có lệch hydration nội dung dữ liệu: dữ liệu luôn fetch phía client.
- **Helper thuần** `shared/ui/data-table-mobile.ts`: `partitionMobileColumns(columns)` trả về `{ primary, secondary[], trailing, detail[], actions }`. Tách ra để test được bằng `tsx --test`.

**Dòng danh sách** (thay `<table>` trong chế độ danh sách):
- Mỗi bản ghi là một `<button>` full-width, `min-h-[52px]`, `px-3 py-2.5`, `border-b border-slate-100`. Không bo góc, không đổ bóng, đúng Flat Enterprise.
- Tầng 1: ô `primary` (`text-[13px] font-medium`, truncate) bên trái, ô `trailing` (số tiền, `tabular-nums`) bên phải.
- Tầng 2: các ô `secondary` nối bằng ` · `, `text-[11.5px] text-slate-500`, truncate.
- `aria-label` của dòng ghép từ text primary và trailing. Bàn phím: Enter/Space mở bảng trượt.
- **Không có** STT, ID, thanh "Ẩn/hiện cột", tay resize, khung cuộn `max-h-[520px]`; trang cuộn tự nhiên.
- **Dải lọc**: nếu có cột `mobileHeader`, render một hàng `overflow-x-auto` không wrap, chứa các `header` của cột đó (mỗi mục cao 40px, viền `rounded-[3px]` như hiện tại).
- **Loading**: 4 dòng skeleton cùng chiều cao 52px, giữ container theo quy tắc skeleton parity. **Empty**: giữ `emptyMessage`.

**Bảng trượt chi tiết** (dùng `Modal` sẵn có, mobile tự thành bottom sheet; giữ `panelClassName` bo góc nhỏ như các modal hiện có):
- Header (`MODAL_STICKY_HEADER`): text primary và nút đóng 40px.
- Body: danh sách `dt/dd` cho **mọi cột** trừ `stt` và `actions`, nhãn lấy từ `column.label`, nội dung lấy từ `column.cell(row)`. Vì cell đã tự render input khi `editingId === row.id`, chế độ **sửa inline hoạt động luôn trong bảng trượt** mà không phải viết form mới.
  - `CategoryAutocomplete` đã portal vào `closest('dialog')`.
  - Popover lọc cột không nằm trong bảng trượt.
- Dòng **ID**: hiện ID rút gọn kèm nút mở `IdExplainerDialog`. Dialog xếp chồng trên bảng trượt nhờ top layer.
- Sau phần `dt/dd`: `renderExpandedRow(row)` nếu có. Với Thu chi đây là chi tiết, ảnh hoá đơn và phân bổ nợ, luôn hiện trong bảng trượt và bỏ qua `isRowExpanded`.
- Footer (`MODAL_STICKY_FOOTER`): `actions.cell(row)` gồm Sửa/Xoá, hoặc Lưu/Huỷ/🔗 khi đang sửa.
- Bảng trượt giữ `selectedRowId`. Nếu row không còn trong `rows` (vd. sau khi xoá) thì tự đóng.

### A1'. Áp vào `TransactionsTable` (màn Thu chi)

| Cột | `mobileSlot` | `mobileCell` | `mobileHeader` |
| --- | --- | --- | --- |
| `note` | `primary` | text ghi chú (không có nút mở rộng, không có số phân bổ) | ✓ |
| `amount` | `trailing` | `+/−` + `money()`, màu thu/chi, **không** có thanh tỉ lệ | ✓ |
| `category` | `secondary` | text | ✓ |
| `occurredAt` | `secondary` | ngày ngắn | — |
| `createdBy` | `secondary` | tên người tạo | ✓ |
| `place` | `secondary` | tên nơi chốn (nếu có) | ✓ |
| `type`, `receipt` | — (chỉ trong bảng trượt) | — | `type` ✓ |
| `runningBalance` | — (chỉ trong bảng trượt) | — | — |

- Nút hành động (`h-[22px]`) thêm `max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[13px]` để bấm dễ trong footer bảng trượt. Desktop giữ nguyên.
- `mobileHeader` chỉ đặt khi `onChangeColumnFilters` có giá trị, đúng như hành vi hiện tại.

### A2. Gộp header vào topbar mobile (≤ 960px)

- Tách từ `workspace-header.tsx` một hook dùng chung `useWorkspaceHeader()`: tiêu đề/phụ đề theo `ROUTE_HEADER_MAP`, `isAuthenticated`, `handleRefresh`, `handleLogout`, `zaloBotUrl`. `WorkspaceHeader` và topbar cùng dùng hook này, không lặp logic.
- **Topbar mobile mới** (`app-navigation.tsx`), cao khoảng 52px, giữ viền và bo góc hiện tại:
  `[☰ 40px] [Tiêu đề trang: text-[15px] font-bold, truncate] [👁 ẩn/hiện số tiền 40px] [⟳ làm mới 40px]`
  - Khi chưa đăng nhập, thay hai nút phải bằng link "Mở Zalo Bot" cao 40px.
  - Logo "T zalobot" bỏ khỏi topbar; drawer vẫn giữ.
- **Đăng xuất** chuyển vào chân drawer, phía trên nút đổi giao diện, chỉ hiện khi đã đăng nhập.
- `WorkspaceHeader` thêm `max-[960px]:hidden`. Phụ đề trang không hiện trên mobile. Desktop không đổi.
- Icon dùng SVG inline giống các icon đang có trong `app-navigation.tsx`, không thêm thư viện.

### A3. Vùng chạm ≥ 40px

- **Topbar**: hamburger `size-8` đổi thành `size-10`; hai nút icon mới `size-10`.
- **Drawer**: link điều hướng `max-[960px]:min-h-8` đổi thành `max-[960px]:min-h-10`; nút giao diện, ô chọn ngôn ngữ và nút đăng xuất cao `max-[960px]:h-10`.
- **Toolbar Thu chi** (`transactions-screen.tsx`):
  - Bỏ `max-[640px]:flex-col`. Bốn chip lọc (Tất cả / Thu / Chi / Điều chỉnh số dư) và chip xoá lọc nằm **một hàng cuộn ngang** `overflow-x-auto flex-nowrap`, mỗi chip `max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[12.5px]`.
  - Ô tìm kiếm xuống hàng riêng full-width, `max-[640px]:h-10`.
  - Nút "Tải thêm" `max-[640px]:h-10`.
- **`PeriodFilterToolbar`** (dùng chung): nút kỳ và mũi tên đổi thành `max-[640px]:min-h-10` / `max-[640px]:size-10`. Ảnh hưởng mọi màn có thanh kỳ, chỉ trên mobile, theo hướng tốt hơn.
- **Nút lọc cột** (`column-filter-popover.tsx`): `size-5` đổi thành `max-[640px]:size-10` (vùng chạm), icon giữ `size-3`.
- Font control giữ nguyên cỡ nhỏ; zoom khi focus trên iOS đã có `IosViewportFix` lo.

## 3. Danh sách file dự kiến

| File | Thay đổi |
| --- | --- |
| `apps/web/src/shared/hooks/use-media-query.ts` | **Mới** |
| `apps/web/src/shared/ui/data-table-mobile.ts` | **Mới**: helper thuần phân slot |
| `apps/web/src/shared/ui/data-table-mobile.spec.ts` | **Mới**: test helper |
| `apps/web/src/shared/ui/data-table.tsx` | Thêm prop cột, nhánh danh sách, bảng trượt |
| `apps/web/src/shared/ui/workspace-header.tsx` | Tách `useWorkspaceHeader()`, ẩn ≤ 960px |
| `apps/web/src/shared/ui/app-navigation.tsx` | Topbar mới, đăng xuất trong drawer, vùng chạm |
| `apps/web/src/shared/ui/period-filter-toolbar.tsx` | Vùng chạm mobile |
| `apps/web/src/modules/dashboard/presentation/components/transactions-table.tsx` | Khai báo slot/mobileCell/mobileHeader, nút 40px |
| `apps/web/src/modules/dashboard/presentation/components/transactions-screen.tsx` | Toolbar một hàng, vùng chạm |
| `apps/web/src/modules/dashboard/presentation/components/column-filter-popover.tsx` | Vùng chạm nút lọc |
| `packages/contracts` (i18n catalog) | Chỉ khi cần key mới (vd. `table.openDetails`, `common.viewId`); dùng lại key sẵn có nếu được |
| `.agents/knowledge/global/web-ui-direction.md` + `.agents/docs/global/web-ui-direction.md` | Cập nhật hợp đồng: danh sách mobile, ẩn STT/ID trên mobile, header gộp vào topbar, chuẩn vùng chạm 40px, giữ bo góc nhỏ |
| Knowledge/docs của module `dashboard` (nếu drift-check yêu cầu) | Ghi hành vi mobile của Thu chi |

Không đổi API, DB hay contract DTO. Không có migration.

## 4. Xác minh

1. `npm run typecheck --workspace @zalobot/web`
2. `npm run lint --workspace @zalobot/web`
3. `npm run test --workspace @zalobot/web` (gồm spec mới của helper)
4. `npm run build --workspace @zalobot/web` (static export)
5. `node .claude/hooks/docs-drift-check.mjs` phải trả về exit 0
6. **Kiểm tra trực quan** bằng trình duyệt tích hợp ở 375×812 và ở desktop:
   - Thu chi: danh sách, bảng trượt, sửa trong bảng trượt, xoá, lọc cột, xem ID.
   - Topbar ở mọi màn.
   - Desktop không đổi.

   Cần stack local (API + Postgres + Redis + `.env.local`). Hiện máy chưa chạy được; nếu vẫn chưa có, em sẽ báo rõ phần này **chưa kiểm chứng**, không tự nhận là đã kiểm tra.

## 5. Rủi ro và cách giảm

| Rủi ro | Cách giảm |
| --- | --- |
| Đổi `DataTable` làm hỏng bảng khác | Chế độ danh sách là opt-in theo `mobileSlot`; nhánh desktop không động tới |
| Nháy layout lần đầu trên mobile (render bảng rồi mới chuyển sang danh sách) | Lúc `loading` dữ liệu chưa có; chấp nhận một frame. Nếu thấy rõ, render skeleton danh sách khi chưa biết kết quả media query |
| Sửa inline trong bảng trượt: input bị bàn phím che | `Modal` đã tính visual viewport và scroll field vào tầm nhìn |
| Popover lọc cột trên mobile | Popover đã có nhánh mobile (neo đáy, cách lề 8px) |
| Hợp đồng tài liệu cũ ("STT/ID luôn hiện", "bảng cuộn ngang") | Cập nhật knowledge/docs trong cùng thay đổi |

## 6. Cần anh duyệt

- Duyệt plan này để em sang Phase 2.
- Hai điểm có thể chỉnh trước khi làm:
  1. Đăng xuất chuyển vào drawer, không để trên topbar. Có ổn không?
  2. Chỉnh vùng chạm của `PeriodFilterToolbar` là component dùng chung, nên các màn khác cũng được lợi trên mobile. Có ổn không?
