# Cải thiện trang Tổng quan và thẻ "Cần chú ý"

Rủi ro: TRUNG BÌNH. Sửa nhiều file, đổi ý nghĩa một con số đang hiển thị, thêm một trường vào `GET /api/dashboard` (chỉ thêm, không phá tương thích). Không đổi DB, không có migration.

## 1. Thẻ "Cần chú ý" đang đếm gì

Công thức ở `dashboard-home-screen.tsx:153`:

```ts
attentionCount = số khoản nợ còn mở + số lời nhắc sắp tới + số việc chưa xong
```

Số 1 anh thấy nghĩa là "đang có 1 thứ chưa xong", không có nghĩa là có việc gì gấp. Thẻ của anh ghi 0 ₫ ở cả hai ô công nợ, nên gần như chắc số 1 đó là **một việc chưa xong hoặc một lời nhắc đang chờ gửi**. Nó nằm trong bảng Việc cần làm hoặc Nhắc nhở ngay bên dưới. Em chưa xem được dữ liệu production vì pane không có phiên đăng nhập, nên chưa nói được đó là mục nào.

Anh không hiểu là đúng, vì thẻ có 4 lỗi:

- Không nói số đó gồm những gì, và không bấm được.
- Không xét thời gian: việc không có hạn, lời nhắc của năm sau, khoản nợ chưa tới hạn đều bị tính. Đó là "đang mở", không phải "cần chú ý".
- Trộn dữ liệu chung (việc, nợ) với dữ liệu riêng (lời nhắc chỉ của người đang xem). Hai người có thể thấy hai số khác nhau.
- Lời nhắc chỉ tính tối đa 10, việc tối đa 50, nên số có thể thiếu. Kỳ khoản cố định đang chờ ghi, thứ thật sự cần anh làm, lại không được tính.

## 2. Một hiểu nhầm nữa cần sửa cùng lúc

"Tổng thu", "Tổng chi", "Thu − Chi" trên Tổng quan **chỉ tính tháng hiện tại**, nhưng nhãn không nói vậy. "Tổng thu 0 ₫" hôm 04/11 nghĩa là tháng 11 chưa có khoản thu, không phải chưa từng có. `Thu − Chi -2.862.000 ₫` cũng dễ bị đọc nhầm là số dư, trong khi số dư ví thật (`ledgerBalance`) đã có sẵn trong dữ liệu nhưng trang không hiện.

## 3. Thiết kế đề xuất

```
┌ Số dư ví ┐┌ Tiết kiệm 👁 ┐┌ Cần chú ý  3 ──┐┌ Người khác nợ bạn ┐
│          ││              ││ 1 quá hạn · 2… ││                   │
├ Thu tháng này ┐┌ Chi tháng này ┐┌ Thu − Chi tháng này ┐┌ Bạn đang nợ ┐

┌ Cần chú ý ──────────────────────────────────────┐
│ Việc quá hạn (1)         Nộp thuế           →  │  → /tasks?period=all
│ Việc đến hạn hôm nay (1) Gọi khách          →  │  → /tasks?period=all
│ Nợ đến hạn trong 7 ngày (1) An              →  │  → /debts
│ Khoản cố định chờ ghi (2)   Tiền điện       →  │  → /recurring
└─────────────────────────────────────────────────┘
(thanh lối tắt và 6 bảng giữ nguyên như hiện tại)
```

### "Cần chú ý" đếm lại theo nghĩa thật

Chỉ đếm thứ **cần người làm gì đó ngay**:

| Loại | Điều kiện | Bấm tới |
| --- | --- | --- |
| Việc quá hạn | chưa xong, hạn trước hôm nay | `/tasks?period=all` |
| Việc đến hạn hôm nay | chưa xong, hạn là hôm nay | `/tasks?period=all` |
| Nợ đến hạn | còn nợ, đã quá hạn hoặc tới hạn trong 7 ngày (cùng mốc với tóm tắt tuần/tháng) | `/debts` |
| Khoản cố định chờ ghi | kỳ ở trạng thái đang chờ | `/recurring` |

- Link việc phải có `?period=all`: `/tasks` mặc định lọc theo tháng, nên việc quá hạn từ tháng trước sẽ không hiện nếu chỉ link `/tasks`.
- Không đếm: việc không có hạn và **lời nhắc**. Bot tự gửi lời nhắc nên không cần anh xử lý; lời nhắc vẫn có bảng riêng.
- Hệ quả anh sẽ thấy: số 1 hiện tại nhiều khả năng thành 0 nếu đó là lời nhắc hoặc việc không có hạn. Đây là đúng ý đồ.

### Thẻ và khung giải thích

- Thẻ KPI: dòng phụ tóm tắt ("1 quá hạn · 2 chờ ghi"), bấm nhảy xuống khung Cần chú ý. Số 0 thì không dùng màu cảnh báo và ghi "Không có gì cần xử lý".
- Khung Cần chú ý: mỗi loại một dòng gồm tên loại, số lượng, tên mục gần nhất và mũi tên; cả dòng là link. Tối đa 4 dòng, nên không dài ra theo dữ liệu.
- Khung không hiện số tiền, nên không có rủi ro lộ tiền khi đang ẩn.
- Khi không có gì: một dòng trạng thái gọn, không chiếm chỗ.
- Điện thoại: thẻ vẫn 2 cột; dòng cao tối thiểu 44px, tên mục dài bị cắt bằng dấu ba chấm, không cuộn ngang. Giữ bo góc 3px hiện có.
- Skeleton tải cập nhật theo 8 thẻ và khung mới.

### Hiện thêm

| Mục | Nguồn | Quy tắc tiền |
| --- | --- | --- |
| Số dư ví | `finance.ledgerBalance` đã có | Mắt toàn cục |
| Tiết kiệm (bấm tới `/savings`) | `finance.savingsTotal` đã có | Mắt tiết kiệm riêng (`useSavingsMoney`, `SavingsVisibilityToggle`) |
| Khoản cố định chờ ghi | Thêm `recurringPending` vào `/api/dashboard` | Không hiện số tiền |
| Nợ và việc đến hạn | `debts`, `tasks` đã có | Không hiện số tiền |
| Nhãn "tháng này" cho thu, chi, thu − chi | Chỉ đổi chữ | Như cũ |

Lịch sắp tới, lời nhắc và việc đã có bảng riêng nên không thêm khung "lịch hôm nay" trùng lặp.

### Không làm lần này

- So sánh với tháng trước, danh mục chi nhiều nhất: cần thêm truy vấn. Làm riêng nếu anh muốn.
- Thêm lối tắt Khoản cố định/Tiết kiệm: 8 ô đang vừa khít lưới điện thoại, và thẻ Tiết kiệm cùng khung Cần chú ý đã dẫn tới hai trang đó.
- Không làm số dư "ví + tiết kiệm", vì sẽ phát sinh thêm một số gộp phải mở cả hai mắt.

## 4. Thay đổi cụ thể

**Contracts** (`packages/contracts/src/index.ts`)
- `IDashboardData.recurringPending: IRecurringOccurrenceItem[]`.
- `APP_ROUTES.tasksAllPeriods` (`/tasks?period=all`).
- Chữ mới vi + en: nhãn tháng này, số dư ví, tiết kiệm, tên các loại cần chú ý, dòng trống. Giữ nguyên `dashboard.incomeTotal|expenseTotal|balance` vì `trend-summary-strip` và Phân tích đang dùng theo kỳ đã chọn.

**API**
- `recurring-transaction.service.ts`: thêm `listPendingItems()` dùng lại `listDue` và `toOccurrenceItem`.
- `reports.controller.ts`: thêm `recurringPending` vào payload.
- `reports-me.spec.ts` hoặc spec mới: payload có các kỳ đang chờ.

**Web**
- Mới `apps/web/src/modules/dashboard/model/home-attention.ts`: hàm thuần `buildHomeAttention(data, now)`, kèm spec phủ biên quá hạn / hôm nay / +7 ngày, việc không hạn, việc đã xong.
- Mới `presentation/components/home-attention-panel.tsx`: khung Cần chú ý.
- `dashboard-home-screen.tsx`: bỏ `attentionCount`, thêm 2 thẻ, `Metric` nhận `href` và `hint`, cập nhật skeleton.
- `recurring-query.ts`: `useSkipOccurrenceMutation` làm mới cache `dashboard`. Hiện bỏ qua một kỳ thì Tổng quan không tự cập nhật.

**Ngày tháng**: hạn được lưu theo quy ước 23:59:59 UTC của ngày đã chọn, nên em so theo phần ngày đã lưu với ngày hiện tại giờ Việt Nam, không so thẳng thời điểm. Khi làm sẽ kiểm tra lại việc tạo từ Zalo có cùng quy ước không, và phủ bằng test.

**Tài liệu**: `.agents/knowledge/modules/dashboard/README.md` (EN), `.agents/docs/modules/dashboard/README.md` (VI), `CONTEXT.md` (định nghĩa **Cần chú ý**), kiểm tra `modules/recurring`.

## 5. Phối hợp với nhánh `feat/savings-amount-visibility`

Thẻ Tiết kiệm cần `useSavingsMoney` và `SavingsVisibilityToggle` của nhánh này, nhánh chưa vào `main`. Hai bên không sửa trùng `dashboard-home-screen.tsx`, chỉ có thể đụng phần chữ trong `contracts`.

Đề xuất: làm mọi thứ khác trước, thẻ Tiết kiệm là commit cuối sau khi nhánh đó vào `main`. Em không tự viết lại store và không hiện tiền tiết kiệm bằng mắt toàn cục. Trong lúc chờ, ô đó tạm chưa có, nên lưới là 7 thẻ.

## 6. Kiểm tra

- `npm run typecheck`, `lint`, `test`, `build` cho web, cộng test và typecheck API, contracts.
- Chạy local, kiểm tra desktop và điện thoại (375px) cả 4 trạng thái; số tiền mặc định ẩn, F5 ẩn lại; bấm từng dòng tới đúng trang.
- `node .claude/hooks/docs-drift-check.mjs`.

## 7. Cần anh quyết

1. **Đồng ý bỏ lời nhắc và việc không có hạn khỏi "Cần chú ý"?** Em đề xuất bỏ.
2. **Merge nhánh con mắt tiết kiệm trước để em thêm thẻ Tiết kiệm sau?** Em đề xuất vậy.

## Việc phát hiện thêm, ngoài phạm vi

`reports.controller.ts:182` tính đầu tháng theo giờ server. Nếu server chạy UTC, ranh giới tháng lệch 7 tiếng so với giờ Việt Nam. Em chưa kiểm tra cấu hình múi giờ production.
