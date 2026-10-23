# Kế hoạch: Nút thêm link trong hộp thoại Drive / Photos của kênh

Trạng thái: **chờ duyệt** · Mức rủi ro: **TRUNG BÌNH** (thêm 1 endpoint API ghi DB, không có migration)

## 1. Cách hiểu yêu cầu

Hộp thoại "📁 Thư mục Google Drive" và "📸 Album Google Photos" là **cùng một component** (`ThreadStorageLinksDialog`, đổi theo `kind`). Mỗi dòng đã có ✏️ Sửa và 🗑️ Xoá; còn thiếu thao tác **tạo**. Code hiện tại chưa có nút tạo ở cả hai bên, nên "tương tự bên Google Photos" được hiểu là **làm cho cả hai hộp thoại**.

**Giả định (phương án A, đề xuất):** "Tạo" = **thêm tay một link có sẵn** (thư mục Drive / album Photos đã có trên Google) vào lịch sử nơi lưu trữ của kênh. Ví dụ: link thư mục cũ từ trước khi hệ thống bắt đầu ghi lịch sử, hoặc thư mục ở tài khoản Google khác. Đây là thao tác còn thiếu trong bộ Thêm/Sửa/Xoá của danh sách.

**Không làm (phương án B):** tạo thật một thư mục/album mới trên Google rồi chuyển media sang đó. Lý do không chọn: việc đổi nơi lưu đã có ở ô "Thư mục Google Drive riêng" / "Tên Album Google Photos riêng" trong cấu hình kênh. Nếu tạo ở đây mà không đổi cấu hình thì thư mục mới cũng không thành "Đang dùng", dễ gây hiểu nhầm. Nếu anh muốn B, báo lại để em viết lại plan.

## 2. Hành vi sau khi làm

- Trong hộp thoại có nút **➕ Thêm link** ở đầu danh sách. Nút hiện cả khi danh sách đang trống; ẩn khi đang tải, khi lỗi, và khi form thêm đang mở.
- Bấm nút → mở form ngay tại đầu danh sách (cùng kiểu với form Sửa):
  - **Đường link** (bắt buộc, focus sẵn). Placeholder theo loại: `https://drive.google.com/drive/folders/…` hoặc `https://photos.google.com/album/…`.
  - **Tên hiển thị** (tuỳ chọn, ≤ 120 ký tự).
  - **Email tài khoản Google** (tuỳ chọn, để trống nếu không rõ).
  - Nút **Huỷ** / **Thêm** (đang gửi: "Đang thêm…").
  - Gợi ý nhỏ dưới form: chỉ thêm link vào danh sách, không tạo thư mục/album mới trên Google và không đổi nơi lưu media mới.
- Kiểm tra giống form Sửa (https, đúng host theo loại, email hợp lệ, tên ≤ 120), cộng thêm:
  - Đường link là bắt buộc.
  - **Không trùng** link đã có của kênh cùng loại: so sánh URL đã chuẩn hoá và id thư mục/album lấy từ URL (vd. `/drive/u/0/folders/ID` và `/drive/folders/ID` là cùng một thư mục). Trùng → lỗi tại ô link: "Link này đã có trong danh sách."
- Thêm xong: form đóng, danh sách cập nhật ngay từ response (không refetch). Dòng mới nằm ngay dưới dòng "Đang dùng" và có Sửa/Xoá như các dòng khác.
- Ngày "Dùng từ … đến …" của dòng thêm tay = **thời điểm thêm** (hạn chế đã biết, xem mục 8).
- Nhật ký hoạt động ghi một dòng **thêm** vào "Nơi lưu trữ của kênh", người thực hiện là admin đang đăng nhập (đi qua `repository.save` nên `AuditLogSubscriber` tự ghi).
- Điện thoại: nút và ô nhập cao 40px như form Sửa; form nằm trong bottom sheet hiện có.

## 3. Contracts — `packages/contracts/src/index.ts`

- `CreateChannelStorageLinkDto { kind: ChannelStorageLinkKind; url: string; displayName?: string | null; googleEmail?: string | null }`.
- `NormalizedChannelStorageLinkCreate { url: string; displayName: string | null; googleEmail: string | null }`.
- Thêm `'url_duplicate'` vào `ChannelStorageLinkUpdateError` (chỉ validator tạo mới trả về mã này).
- Hàm thuần `channelStorageResourceIdFromUrl(kind, url)`: Drive lấy id từ `/folders/<id>`, Photos lấy id từ `/album/<id>` (gồm cả `/lr/album/<id>` mà API Photos trả về); không khớp thì trả lại chính URL (giống các dòng backfill cũ). Dùng chung cho API (cột `resource_id`) và web (kiểm tra trùng).
- `validateChannelStorageLinkCreate(kind, dto, existingUrls: readonly string[])`: dùng lại `validateChannelStorageLinkUpdate` (để không lặp logic), bắt buộc có URL, rồi kiểm tra trùng theo URL chuẩn hoá và resource id.
- API route: dùng lại `API_ROUTES.zcaThreadStorageLinks(threadId)` với `POST`, không thêm route mới.
- i18n (vi/en) `zca.storageLinks.*`: `add` (Thêm link / Add link), `adding`, `addHint`, `addError`, `urlPlaceholderDrive`, `urlPlaceholderPhotos`, `errors.urlDuplicate`.

## 4. API — `apps/api`

- `ChannelStorageLinkService.createLink(input)`: tạo entity (`label: ''`, `firstUsedAt = lastUsedAt = now`, `resourceId` từ helper ở trên) rồi `linkRepository.save` để nhật ký kiểm toán ghi được.
  - Tương thích với `record()`: nếu link thêm tay chính là thư mục/album mà upload sau này dùng, `ON CONFLICT (thread_id, kind, resource_id)` sẽ cập nhật đúng dòng đó (URL/label chuẩn, `google_email` chỉ điền khi đang trống). Không sinh dòng trùng.
- `ZcaController` thêm `@Post('threads/:threadId/storage-links')` (chỉ admin):
  1. `kind` không phải `drive|photos` → 400.
  2. Lấy các dòng của kênh (`listForThread`) → `validateChannelStorageLinkCreate(kind, body, urls cùng loại)`. Lỗi định dạng → 400; trùng → **409**.
  3. `createLink(...)`; nếu vẫn đụng unique constraint (2 request cùng lúc, mã PG `23505`) → 409.
  4. Trả `ChannelStorageLinksResponse` mới (giống PATCH/DELETE, có `resolveCurrentStorage`).
  - Không kiểm tra kênh có tồn tại hay không, nhất quán với GET hiện tại (GET cũng ghi dòng cho bất kỳ `threadId` nào qua `syncCurrentStorage`).

## 5. Web — `apps/web/src/modules/zca`

- `api/zca-api.ts`: `createThreadStorageLink(threadId, data)` → `httpClient.post(API_ROUTES.zcaThreadStorageLinks(threadId), data)`. Nhân tiện đưa comment "Removes the link from the history only…" về đúng chỗ trên `deleteThreadStorageLink` (đang nằm nhầm trên `deleteZcaThreadConfig`).
- `api/zca-query.ts`: `useCreateThreadStorageLinkMutation(threadId)`, `onSuccess` → `setQueryData(zcaQueryKeys.storageLinks(threadId), links)` như hai mutation còn lại.
- Tách form ra file mới `presentation/components/thread-storage-link-form.tsx` (`StorageLinkForm`), dùng chung cho Sửa và Thêm: danh sách field, hiển thị lỗi, `aria-invalid` / `aria-describedby`, nút Huỷ/Lưu. Props: `kind`, giá trị ban đầu, khoá ô URL hay không, nhãn nút gửi, `onSubmit`, `onCancel`, `isPending`, `serverError`. File hộp thoại hiện đã 374 dòng; thêm form tạo vào sẽ quá dài và lặp code.
- `thread-storage-links-dialog.tsx`:
  - `StorageLinkEditForm` chuyển sang dùng `StorageLinkForm` (hành vi Sửa giữ nguyên).
  - Thêm `StorageLinkCreate`: nút ➕ Thêm link ↔ form thêm, kiểm tra trùng ngay trên client với danh sách đang có; lỗi 409 từ server hiện ở ô link ("Link này đã có trong danh sách."), lỗi khác hiện `addError`.
  - `updateErrorMessage` thêm case `url_duplicate`.

## 6. Kiểm thử

- Thêm vào `apps/api/src/zca/storage/channel-storage-link-update.spec.ts` (hoặc file mới `channel-storage-link-create.spec.ts` cùng thư mục):
  - `channelStorageResourceIdFromUrl`: Drive `/drive/folders/ID`, `/drive/u/0/folders/ID?usp=…`; Photos `/album/ID`, `/lr/album/ID`; `photos.app.goo.gl/…` và URL lạ → trả lại URL.
  - `validateChannelStorageLinkCreate`: thiếu URL → `url_required`; chuẩn hoá tên/email; trùng URL → `url_duplicate`; cùng thư mục khác dạng URL → `url_duplicate`; sai host → `url_wrong_host`.
  - `ChannelStorageLinkService.createLink`: lưu qua `save` với `label: ''`, `resourceId` đúng, hai mốc thời gian bằng nhau.
- Chạy: `npm run typecheck`, `npm run lint`, `npm run test` cho `@zalobot/contracts`, `@zalobot/api`, `@zalobot/web`; `npm run build --workspace @zalobot/web`.
- Nếu chạy được dev local: mở hộp thoại Drive và Photos, thêm link hợp lệ / trùng / sai host, xem trên khổ desktop và điện thoại. Không đăng xuất phiên đang có trong browser pane.

## 7. Tài liệu (bắt buộc trước khi xong)

- `.agents/knowledge/modules/zca/channel-storage.md` (EN): endpoint `POST`, DTO, validator tạo mới, quy tắc trùng, cách lấy `resource_id`, mốc thời gian, mục UI; thêm `thread-storage-link-form.tsx` và `zca-api.ts` vào `depends_on`.
- `.agents/docs/modules/zca/channel-storage.md` (VI): mục 2.4a đổi thành "Thêm, sửa và xoá link", giải thích vì sao chỉ thêm link chứ không tạo thư mục, vì sao chặn trùng, và vì sao ngày dùng là ngày thêm.
- `CONTEXT.md`: thuật ngữ **Lịch sử nơi lưu trữ** bổ sung "admin có thể thêm tay link có sẵn".
- Chạy `node .claude/hooks/docs-drift-check.mjs` đến khi exit 0.

## 8. Hạn chế đã biết và câu hỏi cho anh

1. **A hay B?** Em đang làm theo A (thêm link có sẵn). Anh cần B (tạo thật thư mục/album trên Google) thì báo em.
2. **Nhãn nút:** em để "➕ Thêm link" cho rõ là không tạo thư mục mới trên Google. Anh muốn đúng chữ "Tạo" thì em đổi.
3. **Ngày dùng của dòng thêm tay** = ngày thêm (không có ô nhập ngày). Nếu cần nhập "Dùng từ / đến" thì phải thêm 2 ô ngày vào form và cho sửa ngày ở form Sửa. Đó là phần mở rộng, chưa nằm trong plan này.
