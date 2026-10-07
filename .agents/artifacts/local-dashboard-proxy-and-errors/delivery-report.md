# Kết quả triển khai: proxy local và lỗi Dashboard

## Đã thực hiện

- `apps/web/next.config.ts`: Khi chạy Next development server, rewrite `/api/:path*` sang `NEXT_PUBLIC_API_URL` (mặc định `http://localhost:3000`). Khi build production, giữ `output: 'export'` và không khai báo rewrite; Nginx tiếp tục là proxy production.
- `apps/api/src/reports/reports.controller.ts`: Link exchange không có token hợp lệ, đã hết hạn hoặc đã dùng trả một trang HTML tiếng Việt với HTTP `401` và hướng dẫn lấy link mới từ zalo.
- Đồng bộ tài liệu Dashboard cho local routing và cách khắc phục lỗi link.

## Kiểm chứng

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run build`: pass; xác nhận static export production vẫn tạo được các route Dashboard.
- `npx prettier --check apps/web/next.config.ts apps/api/src/reports/reports.controller.ts`: pass.
- Kiểm tra HTTP end-to-end chưa chạy được trong môi trường agent: API local dừng khi zalograf khởi tạo và không phân giải được `api.zalo.org`. Không liên quan tới thay đổi proxy. Môi trường agent cũng không kết nối được tới Next dev server đang có sẵn ở cổng 5173.

## Ghi chú vận hành

- Khởi động lại `npm run dev:web` để Next nạp `next.config.ts` mới, đồng thời chạy `npm run dev:api`.
- Rewrite không thể dựng trang `503` nếu toàn bộ API cổng 3000 đang tắt; đây là giới hạn của Next rewrite. Lỗi token hợp lệ được xử lý trực tiếp bởi API khi API đang chạy.
- `npm run format:check` còn báo các file web đã thay đổi từ trước: `src/shared/api/http-client.ts`, `src/styles.css`, và `next-env.d.ts`; các file trong phạm vi thay đổi này đã đạt Prettier.
