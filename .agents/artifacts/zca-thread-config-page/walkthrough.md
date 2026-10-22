# Walkthrough: Trang cấu hình kênh `/zca/thread?id=…`

Plan: `implementation_plan.md` (đã duyệt, gồm cả bước 1.5 giữ trạng thái bảng trên URL).

## Đã làm

### Contracts
- `APP_ROUTES.zcaThreadPage = '/zca/thread'` và `APP_ROUTES.zcaThread(threadId)` trả về `/zca/thread?id=<encoded>`.

### Logic thuần (có test)
- `model/thread-config-form.ts`: `configToForm`, `memoryDraftFrom`, `resolveChatMemory`, `formToPayload`, tách từ modal cũ và giữ nguyên logic. Spec có 4 test.
- `model/chat-table-url-state.ts`: `parseChatTableState`, `toChatTableQuery`, `CHAT_TABLE_PAGE_SIZES`. Spec có 3 test, gồm giá trị lạ trên URL và kiểm tra chuyển đi chuyển lại không mất dữ liệu.

### Trang mới
- `app/(private)/zca/thread/page.tsx`: `<Suspense>` bọc `ThreadConfigScreen`.
- `view/thread-config-screen.tsx`: đọc `?id=`, lấy tên/loại kênh từ danh sách thread, nếu không có thì từ cấu hình đã lưu. Có 4 trạng thái: thiếu id, đang tải (khung xương), lỗi tải (nút thử lại), không tìm thấy, và form.
- `presentation/components/thread-config/` gồm 17 file, mỗi file ≤ 92 dòng:
  - khung: `config-switch`, `config-toggle-row`, `config-section-card`, `config-field`;
  - các mục: `listen-toggle-card`, `direct-interaction-section`, `media-backup-section` (+ `storage-link-banner`, `media-type-checkboxes`, `media-storage-fields`), `confirmation-rules-section`, `chat-memory-section`;
  - ghép trang: `thread-config-header`, `thread-config-form` (2 cột trên màn ≥ 1024px), `thread-config-action-bar` (dính đáy), `use-thread-config-form`.
- Cỡ chữ mô tả tăng từ 10–11px lên `text-xs`; tiêu đề hàng toggle lên `text-sm`; ô nhập lên `text-sm`.
- Cải thiện a11y đi kèm: nút gạt có `role="switch"`, `aria-label` và viền focus; nhãn gắn với ô nhập; gợi ý gắn qua `aria-describedby`.
- Lưu lỗi giờ báo "Lưu thất bại" (modal cũ bỏ qua lỗi). Lưu xong ở lại trang.

### Bảng `/zca`
- `chat-table-row.tsx`: nút "Cấu hình" thành `<Link href={APP_ROUTES.zcaThread(id)}>`, bỏ prop `onConfigure`.
- `zca-screen.tsx`: 5 `useState` của bảng thay bằng `useChatTableUrlState()`; bỏ `useEffect` reset trang (nó sẽ ghi đè trang khôi phục từ URL), giờ reset trang 1 nằm trong hàm cập nhật; trang hiển thị được kẹp theo `totalPages`, state giữ nguyên để áp dụng khi dữ liệu tải xong; bỏ `ThreadConfigModal`.
- `view/use-chat-table-url-state.ts`: ghi trạng thái lên URL bằng `history.replaceState` và lưu query vào `sessionStorage` cho link quay lại.
- `app/(private)/zca/page.tsx`: bọc `<Suspense>`.
- Xoá `view/thread-config-modal.tsx`.

## Kiểm chứng

- `npm run typecheck --workspace @zalobot/contracts` và `--workspace @zalobot/web`: pass.
- `npx eslint .` trong `apps/web`: exit 0.
  - Một lần chạy `npm run lint` giữa chừng bị lỗi vì session khác đang sửa file dùng chung; chạy lại thì sạch.
- `npm run test --workspace @zalobot/web`: 48/48 pass, gồm 7 test mới.
- `npm run build --workspace @zalobot/web` (production, static export): pass, có `○ /zca/thread`.
  - Build đầu bị lỗi ở `app-navigation.tsx` vì `packages/contracts/dist` cũ hơn source (session "Responsive mobile-friendly pages" vừa thêm key `nav.more`/`nav.tabBar`). Đã chạy `npm run build --workspace @zalobot/contracts` để làm mới `dist` (thư mục được gitignore), không sửa file của session đó.
- **Chưa kiểm chứng bằng mắt**: app không chạy được dev server trong `Documents` (EPERM). Cần chạy `npm run dev:web` để xem 2 cột/1 cột, link quay lại giữ bộ lọc, F5 trên trang cấu hình, `id` sai.

## Tài liệu

- `.agents/knowledge/modules/zca/README.md` và `.agents/docs/modules/zca/README.md`: mục trang cấu hình (thay modal), trạng thái bảng trên URL, cột Thao tác, quy tắc không tràn ngang chuyển sang trang.
- `channel-storage.md`, `chat-memory.md` (EN + VI): đổi tham chiếu modal thành trang và cập nhật `depends_on`.
- `.agents/knowledge/global/route-constants.md` và `.agents/docs/global/route-constants.md`: `zcaThreadPage`, `zcaThread(id)`, quy ước query param cho trang chi tiết.
- `.agents/knowledge/project-overview.md`: thêm trang `/zca/thread?id=`.
- `docs-drift-check`: không còn lỗi cho `zca`. Còn 2 lỗi của module `contacts` và `dashboard`, do session khác đang làm dở, không thuộc task này.

## Lưu ý

- Working tree đang có thay đổi của các session khác (contacts profile, responsive, table chip). Khi commit chỉ nên add các file của task này.
- Kế hoạch `zca-thread-config-delete` (session khác, mới ở Phase 1) sẽ sửa menu ⋯ trong `chat-table-row.tsx`/`zca-screen.tsx`; có thể đụng cùng file với task này.
