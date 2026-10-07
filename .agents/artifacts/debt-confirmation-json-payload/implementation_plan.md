# Kế hoạch: JSON trong xác nhận công nợ

RequestFeedback: true

## Mục tiêu

Hiển thị payload JSON có cấu trúc trong thông báo zalo xác nhận tạo khoản công nợ (`create_debt`), tương tự hộp xác nhận thu–chi hiện có.

## Phạm vi thay đổi

1. `apps/api/src/zalo/services/zalo-ui.service.ts`
   - Tạo payload JSON an toàn từ dữ liệu công nợ: `direction`, `counterparty`, `counterpartyAlias` (khi có), `amount`, `note`, `dueAt` (khi có), và `createNewContact` (khi có).
   - Render khối `Payload JSON` đã escape HTML ngay trước mã yêu cầu; vẫn giữ nguyên các dòng thông tin thân thiện hiện tại.

2. `apps/api/src/zalo/services/zalo-ui.service.spec.ts`
   - Thay assertion hiện tại xác nhận không có JSON bằng assertion kiểm tra tiêu đề, khối JSON và các trường công nợ quan trọng.
   - Giữ các test cho trường hợp khoản vay không có hạn trả để bảo đảm các trường tùy chọn không xuất hiện sai.

3. Tài liệu hợp đồng hiển thị zalo
   - Cập nhật `.agents/knowledge/global/zalo-response-layout.md` (English) và `.agents/docs/global/zalo-response-layout.md` (Vietnamese) để phản ánh JSON payload được hiển thị cho xác nhận `create_debt`.

## Tác động và rủi ro

- Chỉ thay đổi nội dung tin nhắn zalo trước khi người dùng bấm xác nhận; không thay đổi API, database, hay nghiệp vụ tạo khoản nợ.
- Rủi ro thấp về nghiệp vụ nhưng thay đổi ba nhóm tệp (mã, test, tài liệu), nên cần duyệt trước khi thực hiện.

## Kiểm chứng sau khi thực hiện

1. Chạy test chuyên biệt của `zalo-ui.service.spec.ts`.
2. Chạy `npm run typecheck` và `npm run lint` theo quality gate backend.
3. Rà diff để chắc chắn không đụng đến các thay đổi Google OAuth/UI đang có sẵn trong worktree.

## Kết quả thực hiện

- Hoàn thành: JSON payload đã được thêm vào hộp xác nhận `create_debt`, các trường tùy chọn chỉ xuất hiện khi được cung cấp.
- Đã cập nhật test và cả tài liệu canonical/developer về bố cục phản hồi zalo.
- Đã kiểm chứng: test chuyên biệt zalo UI (22/22 pass), `npm run typecheck`, `npm run lint`, và `git diff --check` đều thành công.
