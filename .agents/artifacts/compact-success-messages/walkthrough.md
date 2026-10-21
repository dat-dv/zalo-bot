# Walkthrough: Thu gọn tin nhắn xác nhận thành công

Plan đã duyệt: [implementation_plan.md](implementation_plan.md) (phương án A, áp dụng cho mọi loại thao tác).

## Thay đổi

**API**
- `apps/api/src/zca/confirmation/compact-summary.util.ts` (mới):
  - Hàm thuần `formatShortDateTimeVN`, `formatShortDateVN`, `joinParts`.
  - Mỗi loại thao tác một hàm `summarize…`: thu/chi, xoá giao dịch, công nợ, nhắc nhở, thêm việc, xong việc, tạo lịch, xoá lịch, khoá người dùng, nơi chốn, mặc định.
- `transaction-confirmation.service.ts` (`processConfirm`):
  - Mọi `case` thay `header + renderDtoConfirmationCard + dòng gợi ý` bằng hàm `summarize…` tương ứng.
  - Giữ cách lấy giá trị từ bản ghi đã lưu.
  - `CREATE_PLACE` giữ cơ chế `sendMessageWithResult` + `addTempMessage`.
  - Tham số `options` đổi tên thành `_options`, vì không còn dùng (ESLint `no-unused-vars`); chữ ký hàm không đổi.
- Thẻ chờ duyệt vẫn dùng `renderDtoConfirmationCard`.

**Test**
- `compact-summary.util.spec.ts` (mới, 9 test): năm hiện tại / khác năm, bỏ trường trống, khoản thu không có trường phụ, link hoá đơn trên một dòng riêng, công nợ hai chiều, nhắc nhở có/không lặp, lịch trong cùng ngày / nhiều ngày.
- `transaction-confirmation.service.spec.ts` và `text-input.service.spec.ts`: đổi assertion sang mẫu mới. Test duyệt bằng tim khẳng định nội dung đúng bằng mẫu gọn, không còn "Đã nhận đủ" hay `(trống)`. Test `yes <mã>` khẳng định tối đa 2 dòng.

**Docs**
- Plan ghi sẽ sửa docs module zca. Khi làm, tài liệu đúng chỗ hơn là `global/zalo-response-layout.md`, vì file này đang mô tả thẻ xác nhận và vòng đời thu hồi. Đã cập nhật cả bản EN trong `.agents/knowledge/` và bản VI trong `.agents/docs/`: thêm mục tin thành công dạng gọn, bảng mẫu, và `depends_on` trỏ tới util mới.

## Kiểm chứng đã chạy
- `npm run typecheck --workspace @zalobot/api`: 0 lỗi.
- `npm run test --workspace @zalobot/api`: 387/387 pass.
- ESLint `transaction-confirmation.service.ts`: 27 lỗi, bằng đúng số lỗi có sẵn ở HEAD, không phát sinh lỗi mới. ESLint hai file util mới: sạch. Prettier: sạch.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Chưa kiểm chứng
- Chưa thử tay trên Zalo (plan mục 5.5).
