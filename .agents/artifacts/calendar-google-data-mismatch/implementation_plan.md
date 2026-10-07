---
RequestFeedback: true
Route: implement
Authority: inspect-and-plan
Risk: medium
---

# Kế hoạch sửa đồng bộ hiển thị Calendar

## Mục tiêu

Lưới Calendar phải yêu cầu đúng toàn bộ khoảng ngày đang hiển thị (gồm các ô đệm đầu/cuối tháng), để nội dung khớp Google Calendar của tài khoản đã liên kết. Không thay đổi quyền OAuth, schema database hay các endpoint tạo/sửa/xóa.

## Phạm vi thay đổi

1. **Hợp đồng và web query**
   - Bổ sung kiểu tham số đọc Calendar gồm `timeMin`, `timeMax` và tùy chọn `query` vào `@zalobot/contracts` nếu cần để thống nhất API–web.
   - Tạo hàm xác định biên thời gian cho lưới tháng: từ đầu ô đầu tiên đến đầu ngày ngay sau ô cuối cùng, theo múi giờ trình duyệt.
   - Truyền hai biên này đến `GET /calendar/events`; đưa chúng vào TanStack Query key để mỗi tháng có cache riêng.
   - Khi chuyển tháng hoặc về hôm nay, query tự tải đúng khoảng mới.

2. **Dữ liệu nguồn và lỗi trống**
   - Chỉ sử dụng kết quả thành công của Calendar API cho trang Calendar, bao gồm cả `[]`; không thay bằng dữ liệu Dashboard 7 ngày/tối đa 10 sự kiện.
   - Giữ Dashboard độc lập vì đó là nguồn tóm tắt “sắp tới”, không phải nguồn cho lưới tháng.

3. **Lưới ngày và sự kiện nhiều ngày**
   - Sắp xếp sự kiện vào mọi ô ngày mà khoảng thời gian của chúng giao với lưới, thay vì chỉ theo `startAt`.
   - Bảo toàn sự kiện cả ngày và tránh tạo ô lặp cho event kết thúc đúng 00:00 của ngày kế tiếp.
   - Giữ hiển thị giờ cho event có thời gian; event cả ngày không hiển thị giờ giả.

4. **API backend và giới hạn**
   - Giữ controller chuyển tiếp `timeMin`/`timeMax` như hiện tại, đồng thời xác thực ngày đầu/cuối hợp lệ và bảo đảm `timeMin < timeMax`.
   - Giữ `singleEvents: true` để Google mở rộng sự kiện lặp lại; dùng khoảng yêu cầu do web gửi để Google trả đúng occurrence trong lưới.
   - Không thay đổi hành vi Dashboard 7 ngày.

5. **Kiểm thử và tài liệu**
   - Thêm test cho tính biên lưới tháng, query key theo khoảng thời gian, event quá khứ và event trải qua nhiều ngày/tháng.
   - Cập nhật tri thức canonical `.agents/knowledge/modules/calendar/README.md` bằng tiếng Anh và hướng dẫn `.agents/docs/modules/calendar/README.md` bằng tiếng Việt về hợp đồng dữ liệu theo khoảng thời gian.

## Tệp dự kiến chạm tới

- `packages/contracts/src/index.ts`
- `apps/web/src/modules/calendar/api/calendar-api.ts`
- `apps/web/src/modules/calendar/api/calendar-query.ts`
- `apps/web/src/modules/dashboard/view/calendar-screen.tsx`
- `apps/web/src/modules/calendar/view/calendar-grid.tsx`
- `apps/api/src/google/google-resources.controller.ts`
- Các tệp test mới/cập nhật sát các module trên
- `.agents/knowledge/modules/calendar/README.md`
- `.agents/docs/modules/calendar/README.md`

## Tiêu chí chấp nhận

1. Chuyển tới tháng trước, tháng sau hoặc tháng hiện tại đều tải và hiển thị sự kiện Google thuộc các ô lưới tương ứng.
2. Sự kiện đã qua trong tháng vẫn xuất hiện.
3. Sự kiện kéo dài nhiều ngày xuất hiện ở mọi ngày có hiệu lực, giống Google Calendar.
4. Calendar API trả `[]` thì UI trống đúng nghĩa, không lẫn dữ liệu Dashboard.
5. `npm run lint`, `npm run typecheck`, và các test liên quan đều đạt.

## Rủi ro và cách kiểm soát

- Múi giờ/all-day event có thể gây lệch ngày: test với `date` và `dateTime` ở ranh giới nửa đêm.
- Khoảng lưới dài hơn một tháng: giới hạn đúng 5–6 tuần lưới, không gọi toàn bộ lịch.
- Cache cũ sau sửa/xóa: mutation tiếp tục invalidation tất cả key Calendar theo tiền tố và Dashboard.
