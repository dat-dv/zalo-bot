# Bàn giao: JSON cho mọi thẻ xác nhận

## Đã thực hiện

- Toàn bộ thẻ xác nhận zalo nay có khối `Payload JSON` thuộc `language-json`.
- Khối JSON dùng chung lấy đúng payload sẽ được thực thi, bao gồm luồng xóa công nợ.
- JSON được escape an toàn trước khi đưa vào HTML zalo.
- `duplicateWarnings` không xuất hiện trong JSON vì đây là dữ liệu giao diện và không được gửi tới tool thực thi.

## Kiểm chứng

- `npm run test --workspace @zalobot/api` — đạt 52/52 kiểm thử.
- `npm run lint` — đạt.
- `npm run typecheck` — đạt.
- `git diff --check` — đạt.
