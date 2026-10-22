# Audit CRUD — 2026-10-22

Phạm vi: đối chiếu 3 lớp — API (`apps/api/src/**/*.controller.ts`), Web (`apps/web/src/modules/*/api/*-api.ts`), Bot (`apps/api/src/zalo/text/text-tool.enum.ts`). Docs drift check: PASS.

## Ma trận

| Thực thể | API | Web | Bot (LLM tool) |
| --- | --- | --- | --- |
| Giao dịch | CRUD đủ | CRUD đủ | C, D (không sửa sau khi đã duyệt) |
| Danh mục | CRUD đủ | CRUD đủ | — |
| Nơi chốn | C, R(list), U, D, gộp | đủ | chỉ C |
| Người liên quan + hồ sơ | CRUD đủ, gộp, sync | đủ | — |
| **Công nợ** | CRUD đủ (`POST /debts`, `DELETE /debts/:id`) | **thiếu C và D** — chỉ list, sửa, gộp | C (`MANAGE_DEBT`), list (`DEBTS`) |
| **Trả nợ** | C, R, D — **thiếu U** | C, D | không có tool trả nợ |
| Phân bổ GD → nợ | C, R, D (không U) | C, R, D | — |
| **Lời nhắc** | CRUD đủ | **thiếu C** | C, list; không huỷ qua chat |
| **Google Tasks** | CRUD đủ | **thiếu C** | C, list, hoàn thành; không xoá/sửa |
| Sự kiện lịch | CRUD đủ + resync | đủ | C, R, D; không sửa |
| Người dùng | CRUD đủ, gộp, cấp quyền | đủ | list, ban |
| Cấu hình kênh ZCA | R, upsert (PUT), D | đủ | — |
| Lịch sử nơi lưu trữ | R, U, D (C tự động) | đủ | R |
| Nhật ký kiểm toán | chỉ ghi; đọc 10 dòng trên dashboard | widget dashboard | — |
| Trí nhớ hội thoại | chỉ bật/tắt theo kênh | bật/tắt | tìm kiếm |

## Thiếu thật sự (API có, Web không gọi)

1. **Công nợ — tạo mới & xoá trên Web**: `debts-api.ts` chỉ có `getDebts`, `updateDebt`, `combineDebts`. API `POST /debts`, `DELETE /debts/:id` đã có nhưng không dùng.
2. **Lời nhắc — tạo mới trên Web**: `reminders-api.ts` không có create; API `POST /reminders` có sẵn.
3. **Google Tasks — tạo mới trên Web**: `tasks-api.ts` không có create; API `POST /tasks` có sẵn.

## Thiếu ở cả API

4. **Sửa khoản trả nợ**: không có `PATCH /debts/:id/payments/:paymentId`; nhập sai phải xoá rồi tạo lại.
5. **Sửa phân bổ**: không có PATCH — chấp nhận được (xoá + phân bổ lại).
6. **Nhật ký kiểm toán**: không có endpoint/trang xem đầy đủ (lọc theo thực thể, người, thời gian). Append-only nên không cần U/D.
7. **Trí nhớ hội thoại**: không xem/xoá được tin đã lưu của một kênh (chỉ tự xoá nội dung khi tin bị thu hồi).

## Bot (tuỳ nhu cầu, không bắt buộc)

- Không có: sửa giao dịch đã duyệt, ghi trả nợ, huỷ lời nhắc, xoá/sửa task, sửa sự kiện lịch, sửa/xoá nơi chốn.

## Phát hiện phụ

- `apps/web/src/modules/expenses/` là code chết: không route nào import (`/expenses` redirect sang `/transactions`), chỉ còn `transactions-query.ts` invalidate key `['expenses']`.
- Places/Categories thiếu `GET /:id` — không ảnh hưởng vì web dùng list.

## Đề xuất thứ tự

1. Web: nút **Thêm** cho Công nợ, Lời nhắc, Tasks + nút **Xoá** công nợ (API sẵn, chỉ làm UI).
2. API + Web: sửa khoản trả nợ.
3. Dọn module `expenses` chết.
4. (Tuỳ chọn) Trang Nhật ký kiểm toán; xem/xoá trí nhớ kênh; bổ sung tool bot.
