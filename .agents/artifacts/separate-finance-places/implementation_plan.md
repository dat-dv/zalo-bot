---
RequestFeedback: true
Route: implement
Authority: inspect-and-plan
Risk: high
---

# Kế hoạch: tách nơi chốn/cửa hàng khỏi liên hệ công nợ

## Mục tiêu

Tạo bảng dữ liệu riêng cho nơi chốn/cửa hàng, rồi liên kết từng phát sinh thu–chi với một nơi chốn. Không tiếp tục dùng `debt_contacts` cho mục đích này.

## Hiện trạng đã xác nhận

- `finance_transactions` đang có `contact_id`, vốn liên kết đến `debt_contacts`.
- Khi Gemini nhận `placeName`, `FinanceService.resolveOrCreatePlaceContact()` đang tạo một bản ghi liên hệ công nợ có mô tả “Địa điểm / Quán ăn”.
- Hợp đồng dùng chung đã có `placeName`, nhưng chưa có `placeId`; giao diện bảng Thu chi cũng chưa hiển thị hoặc chỉnh sửa nơi chốn.
- Workspace đang có thay đổi chưa commit ở các phần khác; triển khai sẽ tránh đụng vào chúng ngoài các điểm tích hợp bắt buộc.

## Thiết kế đề xuất

### Mô hình dữ liệu

1. Thêm entity/bảng `finance_places` với các trường: `id`, `user_id`, `name`, `normalized_name`, `created_at`, `updated_at`.
2. Thêm ràng buộc duy nhất theo `(user_id, normalized_name)` để cùng một người dùng không tạo trùng cửa hàng/nơi chốn, đồng thời đặt chỉ mục `user_id`.
3. Thêm `place_id` nullable trên `finance_transactions`, khoá ngoại đến `finance_places`, với `ON DELETE SET NULL`.
4. Giữ `contact_id` cho người liên quan/công nợ. Không tự động chuyển dữ liệu liên hệ cũ vì không thể phân biệt chắc chắn liên hệ là người hay nơi chốn; các phát sinh cũ vẫn hoạt động bình thường với `place_id = null`.

### API và nghiệp vụ

1. Bổ sung route hợp đồng/API cho danh sách, tạo, sửa và xoá nơi chốn; mọi truy vấn luôn giới hạn theo `user_id`.
2. Mở rộng tạo/cập nhật phát sinh với `placeId` và `placeName`:
   - `placeId` phải thuộc người dùng hiện tại;
   - nếu chỉ có `placeName`, chuẩn hoá tên, tìm trước rồi mới tạo bản ghi nơi chốn;
   - giá trị rỗng khi cập nhật sẽ gỡ liên kết nơi chốn.
3. Cập nhật công cụ Gemini tạo/sửa phát sinh để ghi và trả về nơi chốn riêng, không gọi luồng tạo liên hệ công nợ.
4. Khi xoá một nơi chốn, phát sinh vẫn được giữ và `place_id` trở thành `null`.

### Giao diện

1. Thêm cột “Nơi chốn” vào bảng Thu chi và hiển thị tên nơi chốn nếu có.
2. Trong sửa nhanh, dùng ô nhập gợi ý để chọn nơi chốn đã có hoặc tạo nơi chốn mới bằng tên vừa nhập; gửi `placeId`/`placeName` tương ứng.
3. Mở rộng tìm kiếm bảng để lọc theo tên nơi chốn.
4. Bổ sung bản dịch Việt/Anh cho tiêu đề cột và placeholder.

### Hợp đồng, kiểm thử, tài liệu

1. Cập nhật `@zalobot/contracts` cho `ITransactionItem`, request tạo/sửa giao dịch, kiểu `IFinancePlace` và `API_ROUTES.places`.
2. Bổ sung/cập nhật kiểm thử dịch vụ tài chính và Gemini cho: tái sử dụng nơi chốn trùng tên, kiểm tra quyền sở hữu `placeId`, gỡ liên kết, và xoá nơi chốn.
3. Đồng bộ tài liệu kiến thức tiếng Anh và hướng dẫn tiếng Việt của đúng các module bị ảnh hưởng, cùng chỉ mục `.agents/docs/README.md`.

## Tệp dự kiến tác động

- `apps/api/src/database/entities/finance-place.entity.ts` (mới)
- `apps/api/src/database/entities/finance-transaction.entity.ts`
- `apps/api/src/database/database.module.ts`
- `apps/api/src/finance/finance.module.ts`
- `apps/api/src/finance/finance.service.ts`
- `apps/api/src/finance/finance.controller.ts`
- `apps/api/src/gemini/tools/create-finance-transaction.tool.ts`
- `apps/api/src/gemini/tools/update-finance-transaction.tool.ts`
- `packages/contracts/src/index.ts`
- `apps/web/src/modules/dashboard/api/transactions-api.ts`
- `apps/web/src/modules/dashboard/api/transactions-query.ts`
- `apps/web/src/modules/dashboard/view/transactions-screen.tsx`
- Tài liệu `.agents/knowledge/` và `.agents/docs/` phù hợp với module thực tế.

## Kiểm chứng sau khi được duyệt

1. Chạy kiểm tra kiểu và lint toàn workspace.
2. Chạy các bài kiểm thử finance/Gemini liên quan.
3. Xem lại diff để bảo đảm không thay đổi các phần đang dở dang ngoài phạm vi này.

## Kết quả triển khai

- Hoàn thành mô hình `finance_places` và liên kết nullable `finance_transactions.place_id` với `ON DELETE SET NULL`.
- Hoàn thành API nơi chốn, hợp đồng dùng chung, Gemini, dữ liệu dashboard và cột chỉnh sửa/tìm kiếm nơi chốn trong bảng Thu chi.
- Đã cập nhật tài liệu canonical, tài liệu vận hành và chỉ mục module.
- Đã chạy thành công build contracts, typecheck, lint, kiểm thử API (54 bài) và `git diff --check`.

## Giả định

- “Nơi chốn” là danh mục dùng chung cho quán ăn, cửa hàng, địa điểm và đối tác mua bán; mỗi nơi chốn thuộc riêng một người dùng.
- Phát sinh cũ không bắt buộc phải được di trú sang nơi chốn mới vì dữ liệu hiện có không bảo đảm phân loại chính xác.
