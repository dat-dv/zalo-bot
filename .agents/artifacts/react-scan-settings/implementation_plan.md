# Kế hoạch triển khai React Scan

RequestFeedback: true

## Mục tiêu

Thêm `react-scan` cho dashboard Next.js. Tính năng mặc định tắt và người dùng có thể bật/tắt trong tab **Tùy chọn hệ thống**.

## Phạm vi thay đổi

1. Cài `react-scan` vào workspace `@zalobot/web` và cập nhật lockfile.
2. Tạo một client-side provider hoặc component chuyên trách để:
   - đọc lựa chọn từ local storage;
   - mặc định là `false` khi chưa có lựa chọn;
   - chỉ nạp/kích hoạt React Scan ở trình duyệt sau khi người dùng bật;
   - dừng công cụ và xoá trạng thái đã lưu khi người dùng tắt;
   - không chạy trong SSR và không tự bật trên production.
3. Đặt provider tại `AppProviders` để công cụ được khởi tạo sau khi ứng dụng đã sẵn sàng, không làm thay đổi Server Component hoặc App Router layout.
4. Thêm một công tắc có nhãn, mô tả và trạng thái truy cập được trong tab **Tùy chọn hệ thống** của `SettingsScreen`.
5. Bổ sung bản dịch Việt/Anh cho giao diện công tắc.
6. Cập nhật canonical knowledge và hướng dẫn developer của module `settings` để mô tả local preference, hành vi mặc định tắt và cách dùng công cụ.

## Quyết định kỹ thuật

- Dùng local storage, chỉ trong thiết bị/trình duyệt hiện tại; không gửi tuỳ chọn hay dữ liệu profiling về API.
- Chỉ dynamic-import `react-scan` sau khi bật để không tải công cụ vào luồng mặc định và tránh tác động đến production khi tắt.
- Dùng API `scan({ enabled: true })` khi bật và `setOptions({ enabled: false })` khi tắt. Để công tắc có tác dụng trên dashboard production, chỉ lần bật chủ động của người dùng mới cho phép React Scan chạy ở production; trạng thái UI sẽ đồng bộ với khoá local storage.

## Kiểm thử

1. Chạy typecheck và lint cho workspace.
2. Build dashboard static Next.js.
3. Mở Cài đặt → Tùy chọn: xác nhận công tắc mặc định tắt trong local storage trống.
4. Bật: xác nhận toolbar React Scan xuất hiện và khoá local storage được lưu.
5. Tắt và tải lại trang: xác nhận toolbar không xuất hiện, lựa chọn vẫn tắt.

## Rủi ro

React Scan là công cụ profiling chạy phía trình duyệt; khi người dùng bật nó có thể tăng overhead hiển thị. Vì vậy công tắc sẽ luôn mặc định tắt và không được bật bằng cấu hình deploy.
