# Báo cáo triển khai env guard

## Đã thực hiện

- Nạp `.env.local` rồi `.env` từ root trước khi API bootstrap, không ghi đè biến do môi trường triển khai cung cấp.
- Kiểm tra fail-fast các key bắt buộc, URL HTTP(S), boolean, số nguyên dương, timezone, khóa mã hóa và bộ biến GramJS optional.
- Loại bỏ default ENV tại config factory và các điểm tiêu thụ API; các service dùng `ConfigService.getOrThrow`.
- Bỏ fallback Google OAuth credential-file của runtime API; Google client ID/secret là cấu hình bắt buộc.
- Dashboard yêu cầu `NEXT_PUBLIC_API_URL` hợp lệ khi nạp Next config và khi khởi tạo HTTP client.
- Hoàn thiện `.env.example` và bổ sung cặp tài liệu global về hợp đồng cấu hình mới.

## Xác minh

- `npm run typecheck` — đạt.
- `npm run lint` — đạt.
- `npm run build` — đạt, gồm static dashboard build với `.env.local`.
- Kiểm tra cô lập guard — đạt: thiếu `PORT` được báo là lỗi cấu hình.
- `git diff --check` — đạt.
- `npm run agent-system:validate` — phần env guard đạt; lệnh còn bị chặn bởi 12 lỗi tài liệu module `finance`, `google`, `reminders`, `users` đang được thay đổi ở phần việc song song, ngoài phạm vi task này.

## Lưu ý triển khai

Các môi trường đã dựa vào default cũ phải khai báo rõ các key mới trong `.env.example`, đặc biệt `PORT`, `zalo_LONG_POLLING_ENABLED`, các giới hạn Whisper/OCR, timezone, model Gemini và `NEXT_PUBLIC_API_URL`.
