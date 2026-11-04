# Ẩn biểu đồ khi đang ẩn số tiền

Rủi ro: MEDIUM (nhiều file, đổi hành vi hiển thị; không đụng API, schema, dữ liệu).

## Hiện trạng

Nút ẩn số tiền mới che chữ số (`money()`) và tooltip. Phần vẽ biểu đồ không đọc trạng thái ẩn nên vẫn lộ:

| Chỗ | File | Còn lộ gì khi ẩn |
| --- | --- | --- |
| Xu hướng dòng tiền (trang Phân tích) | `apps/web/src/shared/ui/charts/cashflow-trend-chart.tsx` | Trục Y có số thật (25M, 50M, 100M...), chiều cao cột thu/chi, đường số dư |
| Phân bổ chi tiêu (trang Phân tích) | `apps/web/src/shared/ui/charts/category-donut-chart.tsx` | Kích thước lát donut, % từng danh mục, thanh tiến độ |
| Biểu đồ mini Thu/Chi (Giao dịch, Khoản chi) | `apps/web/src/shared/ui/micro-bar-chart.tsx` | Chiều cao cột theo từng kỳ |
| KPI Tỷ lệ tiết kiệm (trang Phân tích) | `apps/web/src/modules/dashboard/presentation/components/analytics-screen.tsx:154` | Tỷ lệ % giữa thu và chi |

`DebtStructureChart` đã làm đúng: chỉ vẽ thanh khi `isMoneyVisible`, vì độ dài thanh lộ độ lớn tương đối. Plan này áp cùng nguyên tắc cho các chỗ còn lại.

## Cách làm

Khi `isMoneyVisible = false`, không render phần vẽ, thay vì chỉ che nhãn. Lý do: chỉ che trục Y thì hình cột vẫn cho thấy thu/chi kỳ nào lớn gấp mấy lần kỳ nào, và dữ liệu hình học vẫn nằm trong SVG của trang.

1. **Component dùng chung** `apps/web/src/shared/ui/charts/masked-chart-placeholder.tsx`: khung giữ đúng `height` để bố cục không nhảy khi bật/tắt, hiện dòng chữ nhỏ cùng kiểu trạng thái rỗng của biểu đồ.
2. **`CashflowTrendChart`**: khi ẩn, render placeholder cao đúng `height` thay cho `ResponsiveContainer`; giữ chú giải Thu nhập / Chi tiêu / Số dư ví. Không render `CustomTooltip`.
3. **`MicroBarChart`**: khi ẩn, render placeholder thay cho SVG và tooltip hover. Áp dụng cho cả desktop và điện thoại vì `TrendSummaryStrip` dùng chung component này.
4. **`CategoryDonutChart`**: khi ẩn, bỏ donut, % và thanh tiến độ; giữ danh sách tên danh mục với số tiền `••••••`. Thứ tự danh mục giữ nguyên như API trả về. Cần xác nhận API có sắp theo số tiền không; nếu có, thứ tự vẫn lộ xếp hạng, khi đó sắp theo tên lúc ẩn.
5. **KPI Tỷ lệ tiết kiệm**: khi ẩn, hiện `common.maskedAmount` thay cho %.
6. **i18n**: thêm key `chart.hiddenWhileMasked` vào cả 2 ngôn ngữ trong `packages/contracts/src/index.ts`. Đề xuất: "Biểu đồ đang ẩn cùng số tiền" / "Chart hidden with amounts".

## Ngoài phạm vi

- **Thanh % đã trả của công nợ**: giữ nguyên, tài liệu hiện ghi rõ thanh này được giữ lại.
- **Số dư xu hướng so với số dư ví khi đã mở số tiền**: `modules/savings` đã ghi nhận đây là known gap (vẫn suy ra được tiền tiết kiệm). Plan này chỉ xử lý trạng thái đang ẩn số tiền, không đổi gap đó.
- **Payload API**: dữ liệu vẫn về trình duyệt như hiện tại, nên nút ẩn chỉ chống nhìn lén màn hình, không phải phân quyền.

## Tài liệu

- Knowledge: `.agents/knowledge/modules/dashboard/README.md` (dòng về chart và masking), `.agents/knowledge/global/web-ui-direction.md` (đoạn Masking).
- Docs: `.agents/docs/modules/dashboard/README.md`.

## Kiểm thử

1. Bổ sung spec cho hành vi ẩn nếu test setup của web cho phép render component; nếu không, tách điều kiện ra hàm thuần để test và ghi rõ phần chưa phủ.
2. `npm run typecheck`, `npm run lint`, `npm run test` theo workspace `@zalobot/web` và `@zalobot/contracts`.
3. `node .claude/hooks/docs-drift-check.mjs`.
4. Chạy thật trên trang Phân tích và Giao dịch, ở cả desktop và điện thoại: tải trang thấy mọi biểu đồ đã ẩn, không có số ở trục, bấm hiện thì biểu đồ trở lại, F5 thì ẩn lại.

## Thực hiện

Làm trong worktree riêng `../zalo-bot-worktrees/masked-charts`, nhánh `fix/masked-charts`, tạo từ `main` local. Chỉ commit khi được yêu cầu.
