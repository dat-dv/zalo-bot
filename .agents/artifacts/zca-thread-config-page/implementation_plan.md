# Implementation plan: Chuyển cấu hình kênh sang trang chi tiết `/zca/thread?id=…`

- Route: implement · Phase 1 (chờ duyệt)
- Rủi ro: **TRUNG BÌNH**: nhiều file web, thêm 1 route, bỏ `ThreadConfigModal`. **Không** đụng API, DB, cấu trúc dữ liệu cấu hình hay hành vi bot.
- Skills: nextjs-static, frontend-orchestration, enterprise-ui, tanstack-query.
- Bối cảnh: modal rộng 672px phải chứa 5 nhóm cấu hình xếp một cột, có 25 chỗ chữ cỡ 10–11px, nên quá chật. Đã chọn hướng trang riêng.

## 1. Quyết định thiết kế

1. **URL là `/zca/thread?id=<threadId>`**: web là static export (`output: 'export'` khi build production) nên không dùng được route động `/zca/[id]`. Trang đọc `?id=` bằng `useSearchParams` trong `<Suspense>`, giống `transactions/page.tsx` và kế hoạch `/contacts/profile?id=`.
2. **Bỏ hẳn `ThreadConfigModal`**: chỉ một nơi sửa cấu hình kênh. Hai dialog nhỏ giữ dạng modal: `ThreadStorageLinksDialog` (Drive/Photos) và `SyncMediaModal`.
3. **Lấy tên và loại kênh**: tìm trong `useZcaThreadsQuery()` theo `id`. Dữ liệu này server trả từ cache Redis, không gọi Zalo. Nếu không thấy thì dùng `threadName`/`threadType` trong cấu hình đã lưu (`ThreadBotConfig`). Nếu vẫn không có loại kênh thì hiện trạng thái "Không tìm thấy cuộc trò chuyện" kèm nút quay lại, không cho lưu, vì API cập nhật bắt buộc `threadType`.
4. **Sau khi lưu**: ở lại trang, hiện thông báo "Đã lưu" và cập nhật lại query như hiện nay. Không tự đóng như modal cũ.
5. **Giữ trạng thái bảng `/zca` khi quay lại**: hiện ô tìm kiếm, bộ lọc, sắp xếp, trang và cỡ trang nằm trong `useState`. Chuyển sang trang khác rồi quay lại thì mất hết, nên cấu hình lần lượt nhiều kênh rất phiền. Chuyển 5 giá trị này vào query của `/zca` (`?q=&filter=&sort=&page=&size=`) bằng `router.replace`, bỏ qua giá trị mặc định để URL gọn. Nút "Quay lại" mở lại đúng URL đó.
   - *Có thể bỏ bước này nếu muốn thay đổi gọn hơn*; khi đó quay lại thì bảng về trạng thái mặc định.
6. **Không thêm cảnh báo "thay đổi chưa lưu"**: modal cũ cũng không có. Nếu cần thì làm task riêng.
7. **Bo góc**: giữ nguyên class bo góc hiện có khi chuyển markup, không tăng và không đồng bộ lại (memory "keep small radius").

## 2. Bố cục trang

- **Header**: nút "← Zalo & Người dùng" (quay lại bảng), avatar chữ cái, tên kênh (cắt `…` kèm `title`), badge Nhóm/Cá nhân, ID (`break-all`).
- **Thân**: `grid grid-cols-1 lg:grid-cols-2 gap-4`.
  - Cột trái: Kích hoạt lắng nghe (Master), Tương tác bot trực tiếp, Quy tắc xác nhận.
  - Cột phải: Lưu trữ tài nguyên (Drive/Photos), Trí nhớ hội thoại.
  - Màn < 1024px: một cột theo đúng thứ tự trên.
- **Thanh hành động** dính đáy màn (`sticky bottom-0`): trạng thái lưu và nút "Lưu cấu hình". Không còn nút "Đóng".
- **Cỡ chữ**: mô tả `text-[10px]`/`text-[11px]` đổi thành `text-xs`, tiêu đề mục giữ `text-sm font-bold`. Giữ quy tắc chống tràn ngang đã làm (`min-w-0`, `shrink-0`, `break-all`, `flex-wrap`).
- **4 trạng thái UI**: đang tải (skeleton), lỗi tải (thông báo kèm nút thử lại), không có `id` hoặc không tìm thấy kênh (thông báo kèm nút quay lại), có dữ liệu thì hiện form.

## 3. Thay đổi theo file

### Contracts

- `packages/contracts/src/index.ts`: thêm `APP_ROUTES.zcaThread: (threadId: string) => \`/zca/thread?id=${encodeURIComponent(threadId)}\`` và `APP_ROUTES.zcaThreadPage: '/zca/thread'` (dùng cho file trang và kiểm tra pathname). Nav đang so khớp `pathname.startsWith('/zca')` nên mục "Zalo & Người dùng" vẫn sáng khi ở trang mới; không cần sửa nav.

### Route (Level 5)

- **Mới** `apps/web/app/(private)/zca/thread/page.tsx`: `metadata` ("Cấu hình cuộc trò chuyện"), `<Suspense><ThreadConfigScreen /></Suspense>`.
- `apps/web/app/(private)/zca/page.tsx`: bọc `<ZcaScreen />` trong `<Suspense>` (cần cho bước 1.5 vì có `useSearchParams`).

### Model (logic thuần, có test)

- **Mới** `apps/web/src/modules/zca/model/thread-config-form.ts`: tách từ modal, không đổi logic:
  - `configToForm(config, threadType)`: giá trị mặc định như `useEffect` hiện tại (ví dụ `requiredHearts` mặc định 5 cho nhóm, 1 cho chat riêng);
  - `memoryDraftFromConfig(config)`, `resolveChatMemory(form, draft)`;
  - `formToPayload(form, draft, threadName, threadType): UpdateThreadBotConfigDto`.
- **Mới** `apps/web/src/modules/zca/model/thread-config-form.spec.ts`: kiểm tra mặc định theo loại kênh, ô số trí nhớ để trống thì về mặc định, payload đủ trường.
- **Mới** `apps/web/src/modules/zca/model/chat-table-url-state.ts` và `.spec.ts` (cho bước 1.5): `parseChatTableState(searchParams)` và `toChatTableQuery(state)`. Giá trị lạ thì về mặc định, `page`/`size` phải là số hợp lệ (`size` thuộc danh sách cỡ trang đang có).

### View (Level 4)

- **Mới** `apps/web/src/modules/zca/view/thread-config-screen.tsx`: đọc `id`, gọi `useZcaThreadsQuery` và `useZcaThreadConfigQuery`, chọn 1 trong 4 trạng thái, ghép header, form và thanh hành động.

### Components (`presentation/components/thread-config/`, mỗi file ≤ ~100 dòng)

- `use-thread-config-form.ts`: hook giữ `form`, `memoryDraft`, `saveSuccess` và `save()`, dùng các hàm ở model.
- `config-toggle-row.tsx`: một hàng gồm tiêu đề, mô tả và nút gạt. Thay cho 8 khối toggle đang lặp lại markup; nhận `checked`, `onChange`, `size: 'lg' | 'md' | 'sm'`, `color`, có `aria-label`.
- `config-section-card.tsx`: khung một mục (icon, tiêu đề, mô tả, toggle bật mục, phần nội dung con).
- `thread-config-header.tsx`, `thread-config-action-bar.tsx`.
- `direct-interaction-section.tsx` (dùng lại `TriggerPrefixInput`), `media-backup-section.tsx` (banner Drive/Photos mở `ThreadStorageLinksDialog`), `confirmation-rules-section.tsx`, `chat-memory-section.tsx`.

### Màn danh sách

- `apps/web/src/modules/zca/presentation/components/chat-table-row.tsx`: nút "Cấu hình" thành `<Link href={APP_ROUTES.zcaThread(thread.id)}>`, bỏ prop `onConfigure`. Dùng link thật để mở được tab mới bằng Cmd/Ctrl+click và để trình đọc màn hình đọc đúng là link.
- `apps/web/src/modules/zca/view/zca-screen.tsx`: bỏ state `selectedThreadForConfig`, import và phần render `ThreadConfigModal`; (bước 1.5) đọc/ghi 5 giá trị bảng qua URL.
- **Xoá** `apps/web/src/modules/zca/view/thread-config-modal.tsx`.

## 4. Tài liệu (Hard Completion Gate)

- `.agents/knowledge/modules/zca/README.md` (EN) và `.agents/docs/modules/zca/README.md` (VI):
  - thay mục `ThreadConfigModal` bằng trang `/zca/thread?id=` (lối vào, cách lấy tên/loại kênh, 4 trạng thái, bố cục 2 cột, lưu xong ở lại trang);
  - chuyển quy tắc "không tràn ngang" sang trang mới;
  - ghi trạng thái bảng nằm trên URL;
  - cập nhật cột Thao tác (nút "Cấu hình" là link).
- `.agents/knowledge/global/route-constants.md`: thêm `zcaThread(id)` và `zcaThreadPage` vào danh sách `APP_ROUTES`.
- `.agents/knowledge/project-overview.md`: thêm trang `/zca/thread?id=` vào danh sách trang dashboard.
- Kiểm tra `.agents/docs/README.md` nếu cần cập nhật mục lục.
- Chạy `node .claude/hooks/docs-drift-check.mjs`, phải pass.

## 5. Kiểm chứng

1. `npm run typecheck --workspace @zalobot/contracts`, rồi `--workspace @zalobot/web`.
2. `npm run lint --workspace @zalobot/web`.
3. `npm run test --workspace @zalobot/web` (spec mới cùng các spec sẵn có).
4. `npm run build --workspace @zalobot/web`: build production bật static export, xác nhận trang `/zca/thread` được xuất tĩnh và không có lỗi `useSearchParams` thiếu Suspense.
5. Thủ công, cần bạn chạy `npm run dev:web` vì app không chạy được dev server trong `Documents` (EPERM):
   - bấm "Cấu hình" từ bảng thì sang trang mới, lưu được, thấy "Đã lưu";
   - "Quay lại" giữ đúng ô tìm kiếm, bộ lọc và trang;
   - F5 trên trang cấu hình vẫn hiện đúng kênh;
   - `id` sai hoặc không có `id` thì thấy trạng thái không tìm thấy;
   - mở Drive/Photos từ trang được;
   - desktop 2 cột, mobile 1 cột, không tràn ngang.

## 6. Rollback

Revert commit. Không có migration hay thay đổi API nên không cần dọn dữ liệu.
