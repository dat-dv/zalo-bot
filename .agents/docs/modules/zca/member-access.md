---
metadata:
  agent-artifact:
    id: docs-module-zca-member-access
    type: documentation
    depends_on:
      - .agents/knowledge/modules/zca/member-access.md
      - apps/api/src/zca/access/thread-access.service.ts
      - apps/api/src/zca/access/group-member-access.policy.ts
      - apps/api/src/zca/guards/grant-access.guard.ts
      - apps/api/src/zca/zca-bot-feature.service.ts
      - apps/api/src/zca/zca-group-members.ts
      - apps/api/src/database/migrations/1724900000000-AddMemberAccessToZcaThreadConfigs.ts
      - apps/web/src/modules/zca/presentation/components/thread-config/member-access-section.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/group-member-picker.tsx
---

# Quyền tương tác theo kênh (nhóm ZCA)

Tài liệu canonical tương ứng: [`member-access.md`](../../../knowledge/modules/zca/member-access.md).

## 1. Bài toán

Trước đây quyền dùng bot chỉ có một loại: **quyền toàn cục** (`users.grant_access`), cấp ở trang "Zalo & Người dùng". Ai đã được cấp thì dùng bot ở mọi nhóm, mọi chat riêng. Muốn cho một người chỉ được gọi bot trong **một nhóm** (ví dụ nhóm gia đình) thì không làm được: hoặc cấp toàn cục, hoặc không cấp.

Giờ admin cấu hình được ngay trên trang cấu hình nhóm `/zca/thread?id=<groupId>`, mục **"Ai được gọi bot trong nhóm"**.

## 2. Quy tắc quyền

Quyền theo kênh **cộng thêm**, không thay thế quyền toàn cục. Một người gọi bot (mention hoặc tiền tố) được xử lý nếu thoả một trong các điều kiện:

1. Là chính tài khoản bot (owner / tự nhắn).
2. Là admin.
3. Kênh đang ở chế độ cho phép người đó (xem bảng dưới).
4. Có quyền toàn cục (`grantAccess = GRANTED`).

| Chế độ | Ý nghĩa |
| --- | --- |
| **Chỉ người đã được cấp quyền toàn cục** (`granted-users`, mặc định) | Như trước đây. Người chưa được cấp mà mention bot sẽ nhận tin "BẠN CHƯA ĐƯỢC CẤP QUYỀN" kèm User ID |
| **Mọi thành viên nhóm** (`all-members`) | Ai trong nhóm cũng gọi được bot |
| **Thành viên được chọn** (`selected-members`) | Chỉ những người được bật trong danh sách thành viên |

Chat riêng **không** có cấu hình này: vẫn chỉ dựa vào quyền toàn cục.

Người được kênh cấp quyền vẫn được lưu vào bảng `users` (trạng thái "Chờ duyệt" trên `/zca`), để tên người tạo giao dịch/lời nhắc hiển thị đúng, nhưng **không** tự có quyền toàn cục.

## 3. Vì sao thiết kế như vậy

- **Strategy theo loại kênh** (`apps/api/src/zca/access/`): `GroupMemberAccessPolicy` cho nhóm, `PersonalAccessPolicy` cho chat riêng; `ThreadAccessService` chọn policy theo loại tin nhắn mà zca-js báo (không tin `threadType` lưu trong DB vì dữ liệu cũ có thể ghi sai `user` cho nhóm). Thêm loại kênh khác chỉ cần thêm một policy.
- **Không dùng Guard/Pipe/Interceptor của NestJS**: tin ZCA đi vào qua callback WebSocket của zca-js, không qua pipeline request của Nest, nên `@UseGuards` không bao giờ chạy. Các "guard" trong dự án là class gọi tay.
- **Kiểm tra quyền đúng một lần, sau khi biết tin có gọi bot**: trong `onMessage`, lưu media, trí nhớ hội thoại và lệnh `yes/cancel/edit <code>` chạy trước. Tin thường trong nhóm (không mention) dừng ở đó, không bị kiểm tra quyền, không bị báo "chưa cấp quyền". Trước đây có 4 chỗ kiểm tra lặp lại; giờ gộp về một.
- `GrantAccessGuard` nhận thêm `threadGrant`. Thứ tự: admin → lưu user chờ duyệt → quyền theo kênh → quyền toàn cục → từ chối.

Hai thay đổi nhỏ do gộp kiểm tra: gợi ý khi gõ `1`/`2` giờ cũng cần quyền; người chưa có quyền mention bot kèm ảnh không đọc được sẽ nhận tin từ chối thay vì bị im lặng.

## 4. Dùng trên dashboard

1. Mở `/zca`, bấm **Cấu hình** ở dòng nhóm.
2. Ở mục **"Ai được gọi bot trong nhóm"**, chọn chế độ.
3. Với **Thành viên được chọn**: danh sách thành viên lấy từ Zalo hiện ra.
   - Tìm theo tên, tên Zalo hoặc UID (không cần gõ dấu).
   - Lọc **Tất cả / Đã chọn**, xem "Đã chọn N/M".
   - Bật công tắc cho từng người. Admin và người có quyền toàn cục hiện "Luôn được dùng bot", không có công tắc.
   - Người đã chọn nhưng đã rời nhóm vẫn hiện, nhãn "Không còn trong nhóm", để admin tắt đi.
   - **Làm mới danh sách** gọi lại Zalo (bỏ qua cache).
4. Bấm **Lưu** ở cuối trang.

## 5. Vận hành & xử lý sự cố

- Danh sách thành viên: `GET /api/zca/threads/:threadId/members` (admin). Server gọi `getGroupInfo` + `getGroupMembersInfo` của zca-js theo lô 50, cache Redis `zca:group_members:<groupId>` 10 phút.
  - Lỗi 400: tài khoản ZCA chưa đăng nhập → đăng nhập lại ở `/zca`.
  - Lỗi 404: Zalo không trả về nhóm (bot đã rời nhóm hoặc ID sai).
  - Một lô hồ sơ lỗi: thành viên vẫn hiện bằng UID.
- Cấu hình lưu ở cột jsonb `zca_thread_configs.member_access` (migration `1724900000000`), mặc định `{"mode": "granted-users", "memberIds": []}` nên nhóm cũ không đổi hành vi.
- Người được chọn vẫn bị từ chối? Kiểm tra: nhóm đang **lắng nghe**, chế độ đúng là "Thành viên được chọn", đã bấm **Lưu**, và người đó thật sự mention bot hoặc dùng tiền tố (tin thường bị bỏ qua).
- Test: `apps/api/src/zca/access/thread-access.service.spec.ts`, `zca-group-members.spec.ts`, `guards/whitelist-guards.spec.ts`, `zca-bot-feature.service.spec.ts` (3 kịch bản chế độ), `apps/web/src/modules/zca/model/group-members.spec.ts`.
