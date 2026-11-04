# Chẩn đoán: /analytics có tính cả tiền tiết kiệm không

## Hiện tượng

Trang `/analytics?period=year&ref=2026-11-04` có vẻ tính cả các khoản tiết kiệm. User nghi do nạp tiền vào ví trước rồi mới chuyển sang tiết kiệm.

## Kết luận

Lượt nạp/rút/số dư ban đầu của nhóm tiết kiệm KHÔNG bị tính vào thu, chi, "Tiết kiệm ròng" hay "Tỷ lệ tích lũy". Phần lệch đến từ khoản thu đã ghi để nạp ví: nó vẫn là khoản thu của kỳ, kể cả khi tiền đã chuyển sang nhóm tiết kiệm. Giả thuyết của user đúng về cơ chế. Chưa xác nhận được trên số thật vì phiên production đã hết hạn.

## Bằng chứng

- `getSummary` chỉ đọc `transactions`, nên thu, chi và `summary.balance` không thấy `saving_movements` (`apps/api/src/finance/finance.service.ts:453`).
- `netSavingsRate` = (thu − chi) / thu, cũng chỉ từ `transactions` (`finance.service.ts:508`).
- "Tiết kiệm ròng" trên màn hình là `summary.balance`, tức thu − chi, không phải tiền trong nhóm (`analytics-screen.tsx:95`).
- "Cân chỉnh số dư" khi tăng số dư tạo một khoản thu loại `income`, danh mục "Điều chỉnh số dư" (`adjust-balance-modal.tsx:102`).
- "Tài sản ròng" cố ý gồm tiết kiệm: ví + tiết kiệm + phải thu − phải trả (`finance.service.ts:613`).
- Công tắc "Tính cả tiết kiệm" mặc định tắt và không giữ qua lần tải trang (`include-savings-store.ts`).
- `/version.json` production là 1.0.218, bản web đã có fix 1.0.217 (`4c14c3ed`). Không đọc được version API.

## Tái hiện

Chạy `getAnalyticsReport` thật với dữ liệu giả, kỳ năm 2026, ngoài repo. Gốc là lương 20tr và chi 5tr. `finance.service.spec.ts`: 25/25 pass.

| Kịch bản | Thu | Tiết kiệm ròng | Tỷ lệ | Số dư ví | Tiết kiệm | Tài sản ròng |
| --- | --- | --- | --- | --- | --- | --- |
| Không nạp tiết kiệm | 20tr | 15tr | 75% | 15tr | 0 | 15tr |
| Nạp 10tr từ lương | 20tr | 15tr | 75% | 5tr | 10tr | 15tr |
| Ghi thu 30tr rồi nạp 30tr | 50tr | 45tr | 90% | 15tr | 30tr | 45tr |
| Cân chỉnh tăng 30tr rồi nạp 30tr | 50tr | 45tr | 90% | 15tr | 30tr | 45tr |
| Số dư ban đầu 30tr | 20tr | 15tr | 75% | 15tr | 30tr | 45tr |

## Phạm vi ảnh hưởng

Khoản thu nạp ví làm tăng tổng thu, "Tiết kiệm ròng", "Tỷ lệ tích lũy", cột thu của biểu đồ và cơ cấu danh mục thu của năm đó. Số dư ví và tổng tiết kiệm vẫn đúng.

## Đối chiếu số thật trên production

Đọc ngày 2026-11-04, chỉ qua GET. Số tiền không chép vào repo.

- Sổ không có giao dịch nào trước năm 2026 và chỉ có đúng một khoản thu. Đó là thu nhập thật của năm, không phải tiền cũ đem nạp ví và không phải "Cân chỉnh số dư".
- Có một lượt Nạp trong tháng 11. Số dư ví tháng 11 khớp chính xác: số dư tháng 10 − chi tháng 11 − tiền nạp.
- Vì toàn bộ thu chi đều nằm trong năm 2026, "Tiết kiệm ròng" của kỳ năm bằng đúng Số dư ví + Tổng tiết kiệm. Đây là trùng khớp toán học, nhìn như trang đã cộng tiết kiệm vào.
- Dữ liệu và tính toán đều đúng. Không có lỗi tính toán. Vấn đề còn lại là nhãn dễ nhầm.

## Đề xuất

1. Không sửa dữ liệu.
2. Tuỳ chọn, cần plan riêng: đổi nhãn "Tiết kiệm ròng" thành "Chênh lệch thu chi" (dashboard đã dùng nhãn này) để khỏi nhầm với nhóm tiết kiệm.
