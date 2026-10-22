---
metadata:
  agent-artifact:
    id: docs-module-zca-directory-cache
    type: documentation
    depends_on:
      - .agents/knowledge/modules/zca/directory-cache.md
      - apps/api/src/zca/zca-directory-cache.ts
      - apps/api/src/zca/zca.service.ts
      - apps/web/src/modules/zca/view/zca-screen.tsx
      - apps/api/src/zca/thread-config.service.ts
      - apps/api/src/zca/zca.controller.ts
---

# Cache danh bạ Zalo (nhóm, bạn bè, tên gợi nhớ)

Tài liệu canonical tương ứng: [`directory-cache.md`](../../../knowledge/modules/zca/directory-cache.md).

## 1. Bài toán

- Bot cần danh sách nhóm và bạn bè của tài khoản Zalo cá nhân (ZCA) để hiển thị trang `/zca`, gắn tên/ảnh/số điện thoại cho người dùng, và biết một ID là nhóm hay chat riêng.
- Lấy danh sách này tốn 4 loại lời gọi Zalo: `getAllGroups`, `getGroupInfo` (mỗi 50 nhóm một lần), `getAliasList`, `getAllFriends`.
- Trước đây kết quả chỉ được giữ trong RAM 3 phút. Cứ mỗi lần mở dashboard, xem báo cáo hay bot liệt kê người dùng sau 3 phút (và sau mỗi lần deploy) là gọi lại Zalo, dễ bị Zalo chặn vì gọi quá nhiều (lỗi 429).
- Danh bạ thay đổi rất chậm, nên không cần gọi lại thường xuyên.

## 2. Cách hoạt động

### 2.1. Lưu trong Redis 7 ngày

- Danh bạ được lưu ở Redis, key `zca:directory:<ownId>` (`ownId` là ID tài khoản Zalo đang đăng nhập). Đăng nhập tài khoản khác sẽ không đọc nhầm danh bạ cũ.
- Bản lưu ghi thời điểm lấy (`fetchedAt`). Trong 7 ngày, mọi nơi cần danh bạ đều đọc từ bản lưu, **không gọi Zalo**.
- Khởi động lại server hay deploy không làm mất bản lưu; khi đăng nhập ZCA, bot nạp ngay bản lưu từ Redis.

### 2.2. Khi nào mới gọi Zalo thật

| Tình huống | Hành vi |
| --- | --- |
| Có bản lưu chưa quá 7 ngày | Trả bản lưu, không gọi Zalo |
| Bản lưu quá 7 ngày | Trả **ngay** bản cũ, đồng thời tự lấy bản mới ở chế độ nền |
| Chưa có bản lưu (lần đầu đăng nhập, Redis mới) | Gọi Zalo một lần để có dữ liệu |
| Admin bấm **Làm mới** hoặc **Đồng bộ thông tin** trên `/zca` | Gọi Zalo ngay để cập nhật bản lưu |

- Bấm nút liên tục trong 30 giây chỉ gọi Zalo một lần, để tránh bị Zalo chặn.
- Nếu Zalo đang lỗi, việc tự lấy lại chỉ thử tối đa 5 phút một lần. Nút bấm thì không bị giới hạn này.

### 2.3. Không để một lần lỗi xoá mất danh bạ

- Nếu lần lấy mới bị lỗi một phần (ví dụ lấy nhóm được nhưng lấy bạn bè lỗi), phần lỗi **giữ nguyên dữ liệu cũ**, phần thành công dùng dữ liệu mới. Bản lưu được đánh dấu "chưa đầy đủ" và sẽ tự thử lại sau.
- Không lấy được tên gợi nhớ thì dùng lại tên gợi nhớ cũ. Có tài khoản không đọc được tên gợi nhớ, nên lỗi này không bị tính là "chưa đầy đủ" (nếu không sẽ phải gọi lại liên tục).
- Lý do: bản lưu dùng tới 7 ngày, nên nếu để một lần lỗi ghi đè thì danh sách bạn bè có thể mất cả tuần.

### 2.4. Đăng xuất

- Đăng xuất ZCA sẽ xoá bản lưu danh bạ của tài khoản đó trong Redis và trong RAM.

## 3. Trên dashboard

- Cạnh nút **Làm mới** ở đầu trang `/zca` có dòng "Cập nhật lúc …" cho biết danh bạ được lấy từ Zalo lúc nào. Rê chuột vào sẽ thấy giải thích về thời hạn 7 ngày.
- Khi thấy tên hoặc nhóm chưa đúng (vừa đổi tên, vừa kết bạn), bấm **Làm mới** để lấy bản mới nhất.
- Sau khi bấm **Đồng bộ thông tin**, bảng cũng tự tải lại danh sách nhóm/bạn bè.

### 3.1. Xoá dòng "Cuộc trò chuyện <id>"

- Dòng dạng "Cuộc trò chuyện <id>" là kênh **vẫn bật lắng nghe nhưng Zalo không còn trả về** trong danh bạ, thường do bot đã rời nhóm hoặc ID đã cũ. Trước đây không có cách nào gỡ dòng này.
- API `DELETE /api/zca/thread-configs/:threadId` (chỉ admin) xoá hẳn cấu hình của kênh: dòng trong bảng `zca_thread_configs`, cache Redis và trạng thái lắng nghe.
  - Nhật ký kiểm toán có lưu bản ghi đã xoá.
  - **Giữ lại** trí nhớ hội thoại, lịch sử link Drive/Photos và file trên Google.
- Kênh **vẫn còn** trong danh bạ Zalo thì API từ chối (409). Xoá kênh đó thì dòng sẽ hiện lại ngay với cấu hình mặc định, nên muốn bot ngừng xử lý nhóm đang hoạt động thì dùng "Bỏ qua" (tắt lắng nghe). Nếu danh bạ đang cũ, bấm **Làm mới** trước.
- Sau khi xoá, nếu kênh đó lại có tin nhắn, bot tự tạo cấu hình mặc định (không lắng nghe). Dòng vẫn không hiện lại.
- Nút "Xoá" trong menu ⋯ trên `/zca` sẽ làm ở bước sau. Trong lúc chờ, admin gọi API trực tiếp được.

## 4. Vận hành & xử lý sự cố

- Xem bản lưu: `redis-cli GET zca:directory:<ownId>`. Xoá để buộc lấy lại ở lần đọc sau: `redis-cli DEL zca:directory:<ownId>`.
- Log của `ZcaService`:
  - `Loaded ZCA directory from Redis (...)` khi đăng nhập.
  - `Fetched ZCA directory: N groups, M friends` mỗi lần gọi Zalo thật; có thêm `(partial, will retry)` nếu bị lỗi một phần.
- Redis không chạy: bot vẫn hoạt động nhưng chỉ giữ danh bạ trong RAM, mất khi khởi động lại.
- Các hằng số nằm trong `apps/api/src/zca/zca.constants.ts`: hạn 7 ngày, tự xoá key sau 30 ngày, giới hạn bấm 30 giây, thử lại tự động sau 5 phút.
