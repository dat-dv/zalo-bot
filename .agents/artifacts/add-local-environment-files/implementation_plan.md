---
RequestFeedback: true
route: implement
authority: inspect-and-plan
risk: medium
title: Bổ sung .env và .env.local cho API
---

# Kế hoạch: Hoàn thiện cấu hình môi trường local

## Mục tiêu

Tạo/cập nhật `.env` và `.env.local` ở root monorepo để có toàn bộ giá trị không nhạy cảm mà API validator yêu cầu: model Gemini, port, Whisper/receipt limits, long polling và timezone.

## Thực hiện

1. Kiểm tra sự tồn tại của hai tệp theo cách không hiển thị secret; nếu đã có, chỉ thêm các key còn thiếu, không ghi đè token/khóa đang dùng.
2. Dùng các giá trị mặc định an toàn từ `.env.example` cho các key không bí mật: `GEMINI_MODEL=gemini-3.5-flash-lite`, `PORT=3000`, URL/timeout/limit cho Whisper và receipt, `zalo_LONG_POLLING_ENABLED=true`, `DEFAULT_TIMEZONE=Asia/Ho_Chi_Minh`, `TESSERACT_LANG_PATH=/app/assets/tessdata`.
3. Nếu một tệp chưa tồn tại, tạo nó với các key bắt buộc còn lại ở dạng placeholder, không tạo hay bịa token/secret thật.
4. Chạy validator cấu hình; báo riêng mọi secret thật sự còn thiếu để anh điền.

## Rủi ro

Trung bình: `.env` có thể chứa secret. Kế hoạch chỉ thêm key thiếu và không hiển thị hoặc ghi đè giá trị hiện có.

## Kết quả

- Đã thêm các key runtime thiếu vào `.env` và `.env.local`; token/secret hiện có được giữ nguyên.
- Validator cấu hình đã xác nhận hợp lệ, không còn key bắt buộc nào thiếu.
