# Ubiquitous language

## Thu–chi

- **Giao dịch**: Một khoản tiền đã phát sinh, thuộc **sổ chung** của cả hệ thống và ghi nhận **người tạo**.
- **Khoản thu**: Giao dịch làm tăng tiền nhận được, ví dụ lương, hoàn tiền hoặc bán hàng.
- **Khoản chi**: Giao dịch làm giảm tiền đã dùng, ví dụ ăn uống, đi lại hoặc mua sắm.
- **Số tiền**: Giá trị dương, lưu bằng đồng Việt Nam (VND), không lưu đơn vị nghìn hoặc triệu.
- **Danh mục**: Nhãn ngắn để nhóm giao dịch, chẳng hạn `Ăn uống`, `Đi lại`, `Lương`; khi không rõ dùng `Khác`.
- **Ngày phát sinh**: Thời điểm giao dịch xảy ra. Nếu người dùng không nêu, mặc định là thời điểm họ nhắn bot.

- **Sổ chung**: Toàn hệ thống chỉ có một kho tài chính (thu chi, nơi chốn, danh bạ công nợ, công nợ, danh mục), không thuộc về người dùng nào; ai nhắn bot hay thao tác trên dashboard cũng ghi vào và xem toàn bộ kho này. Không có sổ riêng theo người dùng.
- **Người tạo**: Người đã ghi giao dịch (người gửi tin Zalo hoặc người dùng dashboard), kèm **nguồn** (nhóm Zalo, chat riêng hoặc dashboard). Chỉ để hiển thị, không dùng để lọc dữ liệu.

## Công nợ

- **Khoản phải thu**: Tiền người khác đang nợ người dùng, thường phát sinh khi người dùng cho mượn.
- **Khoản phải trả**: Tiền người dùng đang nợ người khác, thường phát sinh khi người dùng vay hoặc mua chịu.
- **Người liên quan**: Người cho vay hoặc người đi vay của một khoản nợ.
- **Biệt danh**: Nhãn phân biệt một người liên quan trùng tên với người khác, ví dụ `Trí (Trí Đen)`.
- **Danh bạ công nợ**: Tập người liên quan dùng chung cho cả hệ thống. Mỗi người có một mã cố định; việc tra cứu dùng khóa tên/biệt danh đã chuẩn hoá và so khớp chính xác, không tìm gần đúng bằng `LIKE`.
- **Liên kết tài khoản**: Gắn một Người liên quan với đúng một người dùng zalo của hệ thống (`users.id`). Chỉ admin được gắn/bỏ gắn; trong danh bạ chung, mỗi người dùng chỉ gắn với tối đa một Người liên quan.
- **Lưu dự phòng số điện thoại**: Người liên quan và người dùng zalo đã liên kết bù số điện thoại cho nhau, chỉ điền khi bên kia đang trống, không ghi đè.
- **Số còn lại**: Phần tiền chưa được trả; khoản nợ chỉ hoàn tất khi số này bằng 0.

## Nhật ký kiểm toán

- **Nhật ký kiểm toán**: Bản ghi không thể thay thế về việc thêm, sửa hoặc xoá một dữ liệu, gồm dữ liệu trước/sau, thời điểm và người liên quan nếu xác định được.

## Thao tác chờ duyệt & Thu hồi tin nhắn

- **Thao tác chờ duyệt (Pending Action)**: Yêu cầu thay đổi dữ liệu nhạy cảm được cấp mã 3 số ngẫu nhiên (`code`), gắn thời hạn 5 phút và lưu vào Redis.
- **Xác nhận đa chiều**: Duyệt thao tác bằng tin nhắn (`yes <code>`), thả tim (❤️) đạt ngưỡng quy định, hoặc hủy bỏ bằng `cancel <code>` hay thả phẫn nộ (😡).
- **Thu hồi tin nhắn (Message Recall / Undo)**: Cơ chế gọi API ZCA `undo({ msgId, cliMsgId })` để thu hồi tin nhắn thẻ xác nhận chờ đối với tất cả mọi người trong phòng chat ngay khi hành động được duyệt, hủy, hết hạn hoặc chỉnh sửa.
- **Hành động đi kèm (Companion Action)**: Thao tác phụ được sinh đồng thời trong cùng một luồng (như tạo nơi chốn mới khi ghi thu chi). Khi thao tác chính được duyệt, hành động phụ được tự động cam kết và thu hồi thẻ chờ tương ứng.

## ZCA & Phân vùng lưu trữ Drive

- **ZCA (Zalo Client Account)**: Kết nối tài khoản cá nhân Zalo qua giao thức WebSocket và quét mã QR, cho phép bot tham gia các nhóm chat như người dùng thật.
- **Kênh (Thread / Channel)**: Một cuộc trò chuyện cá nhân (`user`) hoặc nhóm chat (`group`) trên Zalo, có ID nguyên bản (`channelId`) độc lập.
- **Danh tính kênh Zalo**: Cùng một người có thể có nhiều ID: ID theo app của Zalo Bot chính thức (webhook, 20 ký tự hex) và UID Zalo cá nhân qua ZCA (dạng số). Hệ thống chỉ coi `users.id` là danh tính.
- **Gộp tài khoản (User Merge)**: Thao tác của admin chuyển dấu vết của một ID trùng (người tạo giao dịch, liên kết người liên quan, lời nhắc, token Google) sang người dùng giữ lại, rồi xoá ID trùng. Dữ liệu tài chính là sổ chung nên không phải di chuyển. Chạy trong một transaction và không thể hoàn tác.
- **Phân vùng lưu trữ (Drive Partition)**: Thư mục Google Drive được tạo riêng biệt cho từng kênh theo quy chuẩn `zalobot/<channelId>/<category>` (`bill`, `image`, `video`, `file`, `audio`).

