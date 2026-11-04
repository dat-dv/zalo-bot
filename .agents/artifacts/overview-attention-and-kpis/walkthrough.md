# Kết quả: Tổng quan và thẻ "Cần chú ý"

## Đã làm

- "Cần chú ý" chỉ đếm việc quá hạn, việc đến hạn hôm nay, nợ quá hạn hoặc đến hạn trong 7 ngày, kỳ khoản cố định chờ ghi.
- Thẻ có dòng tóm tắt và nhảy xuống khung liệt kê; mỗi dòng trong khung là link tới đúng trang.
- Thêm thẻ Số dư ví; ba ô thu chi ghi rõ "tháng này".
- `GET /api/dashboard` có thêm `recurringPending`.
- Bỏ qua một kỳ khoản cố định giờ làm mới dữ liệu Tổng quan.

## Khác với plan

- Hạn: plan định so theo phần ngày đã lưu, nhưng hạn từ Zalo là thời điểm thật. `dueDay` xử lý riêng hạn chọn trên dashboard (23:59:59 UTC) và hạn từ Zalo (đọc theo giờ Việt Nam).
- Không có gì cần làm: không hiện khung; thẻ tự ghi "Không có gì cần xử lý".

## Chưa làm

- Thẻ Tiết kiệm: chờ `feat/savings-amount-visibility` vào `main`. Khi thêm, thẻ Cần chú ý trở về 1 cột để lưới đủ 8 ô.

## Kiểm tra

- typecheck, lint, test (web 157, API 923), build web và API, docs-drift-check đều qua.
- UI chạy local với API giả: desktop và 375px, có dữ liệu, trống, ẩn và hiện số tiền, tải lại ẩn lại, không cuộn ngang, dòng cao 47px, `/tasks?period=all` chọn đúng "Tất cả".
- Chưa chạy với DB thật hay trên production.
