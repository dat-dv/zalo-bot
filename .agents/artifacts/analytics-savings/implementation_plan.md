# Plan: đổi nhãn "Tiết kiệm ròng" trên trang Phân tích

## Mục tiêu

Ô thu − chi trong khối "Kết quả trong kỳ" của `/analytics` không còn bị hiểu nhầm là tiền trong nhóm tiết kiệm. Chẩn đoán nằm ở [diagnosis.md](diagnosis.md).

Rủi ro: thấp. Chỉ đổi chữ hiển thị, không đổi API, dữ liệu hay cách tính.

## Thay đổi

### 1. Nhãn (`packages/contracts/src/index.ts`)

| Dòng | Key | Hiện tại | Mới |
| --- | --- | --- | --- |
| 1024 | `analytics.kpi.netSavings` (vi) | `Tiết kiệm ròng` | `Chênh lệch thu chi` |
| 2413 | `analytics.kpi.netSavings` (en) | `Net Savings` | `Net income/expense` |

Hai nhãn mới trùng với `dashboard.thisMonthBalance` đang dùng ở trang Tổng quan, nên cùng một khái niệm có cùng tên trên cả hai trang.

### 2. Tài liệu

- `.agents/knowledge/modules/dashboard/README.md:88`: đổi `net savings` thành `net income/expense (income − expense, not savings groups)`.
- `.agents/docs/modules/dashboard/README.md:148`: đổi "Tiết kiệm ròng, Tỷ lệ tiết kiệm" thành "Chênh lệch thu chi, Tỷ lệ tích lũy". "Tỷ lệ tiết kiệm" ở đây đã lệch so với nhãn thật nên sửa luôn.

## Không làm

- Không đổi tên key i18n, tên field API (`summary.balance`, `netSavingsRate`) hay biến trong `analytics-screen.tsx`. Đây là tên nội bộ, người dùng không thấy, đổi sẽ mở rộng thay đổi mà không có lợi cho người dùng.
- Không đổi nhãn "Tỷ lệ tích lũy" (vi): không có chữ "tiết kiệm" nên không gây nhầm.
- Không đổi nhãn tiếng Anh "Savings Rate", dù vẫn có chữ Savings. Nếu anh muốn đổi luôn, đề xuất dùng `Retention Rate`; thêm 1 dòng tại `packages/contracts/src/index.ts:2414`.
- Không đổi công thức, không loại danh mục nào khỏi tổng thu chi.
- Không sửa dữ liệu production.

## Kiểm tra

1. `npm run typecheck --workspace @zalobot/contracts`
2. `npm run typecheck --workspace @zalobot/web`
3. `npm run lint --workspace @zalobot/contracts`
4. `node .claude/hooks/docs-drift-check.mjs`
5. Build contracts rồi `npm run build --workspace @zalobot/web`, kiểm tra `git status` không có file sinh lạc vào repo.
6. Xem trang `/analytics` ở máy local, hoặc trên production sau khi anh cho deploy, cho cả hai ngôn ngữ nếu có dữ liệu.

## Commit

- Thực hiện trên nhánh hiện tại `claude/happy-dewdney-e7c1c0` (đang dựa trên `main` local, chưa có commit riêng).
- Worktree chưa build contracts và phải kiểm tra lại dependency trước khi chạy bước 1.
- Stage riêng các file trên và thư mục artifact này. Hook pre-commit tự tăng version và ghi CHANGELOG, không tăng tay.
- Chỉ merge hoặc push khi anh yêu cầu.
