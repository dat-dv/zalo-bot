---
metadata:
  agent-artifact:
    id: docs-module-savings
    type: documentation
    depends_on:
      - .agents/knowledge/modules/savings/README.md
      - apps/api/src/finance/savings.service.ts
      - apps/web/src/modules/savings/presentation/components/savings-screen.tsx
---

# Nhóm tiết kiệm

Tài liệu chuẩn cho AI: [`README.md`](../../../knowledge/modules/savings/README.md)

## Vì sao có tính năng này

Trước đây muốn để dành tiền thì chỉ có thể ghi thành khoản chi. Cách đó làm số liệu sai: chi tiêu bị đội lên và tỷ lệ tiết kiệm lại giảm, dù thực tế người dùng đang để dành nhiều hơn.

Nhóm tiết kiệm coi việc để dành là **chuyển tiền** từ ví sang nhóm. Tiền vẫn là của mình, chỉ không còn nằm trong số dư đang tiêu được.

Lưu ý: "ẩn" ở đây là ẩn **khỏi số dư**, không phải ẩn với người khác. Nhóm tiết kiệm thuộc sổ chung nên ai đăng nhập cũng thấy. Tính năng chỉ thao tác trên dashboard, không có lệnh Zalo.

## Ba loại lượt nạp/rút

| Loại | Số dư ví | Tiết kiệm | Khi nào dùng |
| --- | --- | --- | --- |
| Nạp | Giảm | Tăng | Bỏ tiền vào nhóm |
| Rút | Tăng | Giảm | Lấy tiền về ví |
| Số dư ban đầu | Giữ nguyên | Tăng | Tiền đã để dành từ trước khi dùng app |

Rút tiền không phải khoản chi. Muốn tiêu số tiền đó thì rút về ví rồi ghi khoản chi như bình thường, nhờ vậy chi tiêu vẫn tính đúng tháng phát sinh.

## Quy tắc

- Không rút quá số dư nhóm. Hệ thống khoá dòng nhóm khi ghi nên hai lượt rút cùng lúc không làm âm số dư.
- Nạp vượt số dư ví vẫn được, vì ví vốn đã có thể âm.
- Không sửa lượt nạp/rút; muốn đổi thì xoá rồi thêm lại. Không xoá được lượt nếu việc đó làm nhóm âm: ví dụ đã rút hết tiền thì phải xoá lượt rút trước.
- Nhóm không bị xoá hẳn, chỉ được lưu trữ, vì lịch sử của nhóm là một phần của số dư. Chỉ lưu trữ được khi nhóm hết tiền. Tên nhóm đã lưu trữ không dùng lại được.

## Công tắc "Tính cả tiết kiệm"

Công tắc nằm ở trang Thu chi và Phân tích, chỉ hiện khi đang có tiền tiết kiệm. Nó chỉ đổi số hiển thị, không ghi gì vào dữ liệu, và tự tắt khi tải lại trang.

Tài sản ròng luôn tính cả tiết kiệm, không phụ thuộc công tắc. Biểu đồ dòng tiền ở trang Phân tích vẫn vẽ thu − chi luỹ kế nên đường số dư đã gồm tiết kiệm; biểu đồ có chú thích về điều này.

## Cách thao tác

1. Vào **Tiết kiệm** trong nhóm Tài chính ở thanh bên (điện thoại: tab Thêm), bấm **Tạo nhóm**.
2. Nếu đã có sẵn tiền để dành, bấm **Số dư ban đầu** để nhập, số dư ví không đổi.
3. Bấm **Nạp** hoặc **Rút** để chuyển tiền. Trên điện thoại, chạm vào dòng nhóm để thấy các nút.
4. Bấm **Lịch sử** để xem hoặc xoá lượt.

Các khoản trước đây đã ghi thành khoản chi không tự chuyển: cần xoá khoản chi đó rồi nhập số dư ban đầu.

## Kiểm thử

`apps/api/src/finance/savings.service.spec.ts` kiểm tra cách tính số dư và các quy tắc trên. `transaction-ledger-rows.spec.ts` ở web kiểm tra việc chèn lượt nạp/rút vào bảng thu chi.

## Con mắt riêng của số tiền tiết kiệm

Tiền tiết kiệm có công tắc ẩn/hiện riêng, không liên quan tới nút "Hiện số tiền" toàn cục, để mở xem thu chi không làm lộ khoản để dành. Trạng thái chỉ nằm trong bộ nhớ nên tải lại trang là ẩn lại, và dùng chung cho `/savings`, `/analytics`, `/transactions` cùng hộp lịch sử.

- **Theo mắt tiết kiệm**: số dư nhóm, tổng tiết kiệm, lượt nạp/rút, hạn mức rút, dòng nạp/rút trong bảng Thu chi.
- **Cần mở cả hai mắt**: ví + tiết kiệm, tài sản ròng, số dư khi bật "Tính cả tiết kiệm". Nếu chỉ theo mắt toàn cục thì lấy số gộp trừ số dư ví là ra tiền tiết kiệm.
- **Hạn chế**: khi mắt toàn cục mở, chênh lệch số dư ví trước và sau dòng nạp/rút, cùng đường số dư ở biểu đồ Phân tích so với số dư ví, vẫn có thể suy ra tiền tiết kiệm.
