# Kế hoạch: Thu gọn tin nhắn "đã xác nhận thành công" (phương án A, áp dụng mọi loại thao tác)

- Route: implement | Phase 1 (inspect-and-plan)
- Mức rủi ro: **MEDIUM**. Chỉ đổi nội dung tin nhắn, không đổi luồng duyệt, dữ liệu hay API. Phạm vi gồm 1 service, 1 util mới, spec và docs.

## 1. Bối cảnh

Log nhóm ngày 2026-10-21: tin "bánh mỳ 15k, cà phê đen 15k" sinh ra 2 tin thành công, mỗi tin khoảng 10 dòng. Trên điện thoại hai tin này chiếm gần cả màn hình. Nguyên nhân trong `apps/api/src/zca/confirmation/transaction-confirmation.service.ts` (`executeAction`, ~dòng 1196-1450):

- Tiêu đề dài: `🎉 Đã nhận đủ 1 lượt thả tim (❤️)! Yêu cầu [230] đã được xác nhận thành công!` (khi duyệt bằng tim), hoặc `✅ ĐÃ XÁC NHẬN VÀ …` (khi duyệt bằng chữ).
- Thân tin là `renderDtoConfirmationCard`: mỗi trường một dòng, trường trống in `(trống)`.
- Một số loại thao tác còn thêm dòng gợi ý (`💡 Gõ /tasks…`, `🔗 Sự kiện đã được đồng bộ…`).

## 2. Hành vi mong muốn

Tin thành công của **mọi loại thao tác** chỉ còn **1–2 dòng**:
- Dòng 1: biểu tượng + `[mã]` + nội dung chính.
- Dòng 2: thông tin phụ (thời gian, địa điểm…), chỉ in khi có.
- **Bỏ trường trống**, bỏ câu "Đã nhận đủ N lượt thả tim", bỏ các dòng gợi ý.
- Duyệt bằng tim hay bằng chữ (`yes <mã>`) đều ra **cùng một mẫu**.
- Thời gian dạng ngắn `08:30 21/10`. Chỉ thêm năm khi khác năm hiện tại (`08:30 21/10/2025`). Múi giờ vẫn là Asia/Ho_Chi_Minh.

**Mẫu từng loại** (`·` ngăn cách phần tử; phần trong `[]` chỉ in khi có giá trị):

| Thao tác | Mẫu |
|---|---|
| Ghi thu/chi (`RECORD_TRANSACTION`, `create`) | `✅ [230] Chi 15.000đ · Ăn uống · bánh mỳ`<br>`📍 đối diện ctgroup · 🕗 08:30 21/10 · 💳 Tiền mặt · 🧾 ảnh hoá đơn` |
| Xoá giao dịch (`DELETE_TRANSACTION`, `delete`) | `🗑️ [231] Đã xoá chi 15.000đ · Ăn uống · bánh mỳ`<br>`🕗 08:30 21/10` |
| Công nợ (`MANAGE_DEBT`) | `✅ [232] Nam (Nam Béo) nợ bạn 100.000đ · tiền ăn` hoặc `✅ [232] Bạn nợ Nam 100.000đ · …`<br>`🕗 08:30 21/10 · ⏳ hạn 30/10` |
| Nhắc nhở (`SET_REMINDER`) | `⏰ [233] Nhắc "tắt bếp" lúc 09:15 21/10`<br>`🔁 hàng ngày · 📞 gọi điện` (dòng 2 chỉ hiện khi có lặp lại hoặc gọi điện) |
| Thêm việc (`CREATE_TASK`) | `✅ [234] Thêm việc: nộp báo cáo · ⏳ hạn 22/10`<br>`📝 ghi chú…` |
| Hoàn thành việc (`COMPLETE_TASK`) | `☑️ [235] Đã xong: nộp báo cáo` |
| Tạo lịch (`CREATE_CALENDAR_EVENT`) | `📅 [236] Họp dự án · 14:00–15:00 22/10`<br>`📍 Phòng A · 🔔 trước 10p` |
| Xoá lịch (`DELETE_CALENDAR_EVENT`) | `🗑️ [237] Đã xoá lịch: Họp dự án · 14:00 22/10` |
| Khoá người dùng (`BAN_USER`) | `⛔ [238] Đã khoá Trí (id …) · đã thu hồi quyền và token Google`<br>`📝 lý do…` |
| Tạo nơi chốn (`CREATE_PLACE`) | `📍 [239] Đã tạo nơi chốn: đối diện ctgroup` |
| Loại khác (`default`) | `✅ [240] Đã xác nhận` |

Ghi chú:
- Thu/chi: nếu tách riêng thì "Thu"/"Chi", đi cùng số tiền thì "Thu 50.000đ"/"Chi 15.000đ". Có link ảnh hoá đơn thì vẫn in **link đầy đủ trên một dòng riêng** `🧾 <url>`, vì người dùng cần bấm vào. Mẫu `🧾 ảnh hoá đơn` ở bảng trên chỉ minh hoạ vị trí.
- Không đổi: thẻ **chờ duyệt** (vẫn đủ trường như hiện nay, vì cần xem kỹ trước khi duyệt), tin "❤️ x/y", thông báo `💡 Bạn còn N yêu cầu…`, kết quả `yes all`, các tin báo lỗi.

## 3. Thay đổi dự kiến

### 3.1 Util mới — `apps/api/src/zca/confirmation/compact-summary.util.ts`
- Hàm thuần, không I/O, mỗi loại một hàm:
  - `formatShortDateTimeVN(value, now?)`
  - `summarizeTransaction(code, dto)`, `summarizeDeletedTransaction`, `summarizeDebt`, `summarizeReminder`, `summarizeTask`, `summarizeCompletedTask`, `summarizeCalendarEvent`, `summarizeDeletedCalendarEvent`, `summarizeBannedUser`, `summarizePlace`, `summarizeGeneric`.
- Dùng lại kiểu DTO hiện có (`CreateFinanceTransactionDto`, `CreateDebtDto`, `DeleteTransactionDto`…) và `formatCurrencyVN` từ `dto-descriptor.util.ts`.
- Helper `joinParts(parts)`: bỏ phần tử rỗng rồi nối bằng ` · `; dòng nào rỗng thì bỏ cả dòng.

### 3.2 `transaction-confirmation.service.ts`
- Trong từng `case` của `executeAction`, thay `header + renderDtoConfirmationCard(...)` (và các dòng gợi ý) bằng hàm `summarize…` tương ứng.
- Giữ nguyên cách lấy giá trị sau khi lưu (`tx?.amount ?? payload.amount`, `debt?.originalAmount`…) để tin phản ánh đúng dữ liệu đã lưu.
- `CREATE_PLACE` giữ cơ chế `sendMessageWithResult` + `addTempMessage` hiện có.
- `options.isHeartConfirmed` / `requiredHearts` không còn dùng cho nội dung tin. Tham số được giữ lại, không đổi chữ ký hàm.
- Bỏ import descriptor nào không còn dùng. `renderDtoConfirmationCard` vẫn dùng cho thẻ chờ.

### 3.3 Test
- Spec mới `compact-summary.util.spec.ts`:
  - Thu/chi đủ trường và thiếu trường (không còn `(trống)`); khoản thu và khoản chi; có ảnh hoá đơn.
  - Công nợ hai chiều, có và không có biệt danh hoặc hạn trả.
  - Nhắc nhở có và không có lặp lại.
  - Lịch cùng ngày và khác ngày.
  - `formatShortDateTimeVN` cùng năm và khác năm.
- Cập nhật `transaction-confirmation.service.spec.ts`: các dòng 216, 376, 403, 436, 483, 512, 539, 567, 599, 1206-1213, 1443 đang khớp chuỗi cũ, đổi sang mẫu mới. Thêm một test: duyệt bằng tim và bằng chữ ra cùng nội dung, tối đa 2 dòng khi không có ảnh hoá đơn.
- Cập nhật `text-input.service.spec.ts` dòng 359 và 565 (khớp chuỗi cũ của tin thành công). Dòng 1219 là thẻ chờ, giữ nguyên.

### 3.4 Docs
- `.agents/knowledge/modules/zca/README.md` (EN): thêm mục ngắn về định dạng tin thành công (1–2 dòng, bỏ trường trống, cùng mẫu cho tim/chữ, thẻ chờ giữ nguyên) và trỏ tới `compact-summary.util.ts`.
- `.agents/docs/modules/zca/README.md` (VI): giải thích lý do (đỡ chiếm màn hình điện thoại, thẻ chờ đã bị thu hồi nên không cần nhắc lại "đã nhận đủ tim") và bảng mẫu.
- Chạy `node .claude/hooks/docs-drift-check.mjs` đến khi exit 0.

## 4. Ngoài phạm vi
- Thẻ chờ duyệt (phương án B và D) và gộp nhiều khoản vào một thẻ (phương án C).
- Tin của webhook Zalo Bot chính thức nếu có định dạng riêng ngoài `TransactionConfirmationService` (sẽ rà khi thực thi; nếu có thì chỉ ghi nhận, không sửa).

## 5. Kiểm chứng
1. `npm run typecheck --workspace @zalobot/api`
2. `npm run test --workspace @zalobot/api`
3. ESLint và Prettier trên các file đã sửa (không phát sinh lỗi mới)
4. `node .claude/hooks/docs-drift-check.mjs`
5. Thử tay sau deploy: `@den bánh mỳ 15k, cà phê 15k ở đối diện ctgroup`, thả tim từng thẻ → mỗi tin thành công chỉ 2 dòng.

## 6. Rủi ro
- Ai đang quen đọc đủ 8 trường sẽ thấy ít thông tin hơn. Bù lại, mọi trường có giá trị vẫn được in, chỉ bỏ trường trống, và dashboard vẫn có đủ chi tiết.
- Ghi chú hoặc tên rất dài vẫn có thể làm dòng dài. Không cắt bớt, để không mất thông tin.
