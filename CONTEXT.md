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
- **Hồ sơ**: Trang gom mọi thông tin về một Người liên quan và người dùng zalo đã liên kết với họ (nếu có): SĐT và tài khoản chính/phụ, ngày sinh, quan hệ, địa chỉ, nơi làm việc, ghi chú, cùng các khoản nợ và giao dịch của họ. Gốc của hồ sơ là Người liên quan; người dùng zalo chưa có Người liên quan thì admin tạo hồ sơ để tạo và liên kết.

## Lịch

- **Sự kiện lịch**: Một cuộc hẹn hoặc việc có giờ giấc, lưu trong **lịch chung** của zalobot, ghi nhận **người tạo** và nguồn (nhóm Zalo, chat riêng, dashboard hoặc Google Calendar).
- **Lịch chung**: Toàn hệ thống có một lịch duy nhất giống sổ chung; ai cũng xem được mọi sự kiện. Đổi tài khoản Google không làm mất sự kiện.
- **Sự kiện cả ngày**: Sự kiện không có giờ; ngày kết thúc được lưu là nửa đêm sau ngày cuối (như Google Calendar).
- **Bản sao Google**: Bản chép của sự kiện trong Google Calendar của tài khoản đang kết nối, để điện thoại nhận nhắc. Mỗi sự kiện nhớ bản sao nằm ở tài khoản nào; bản sao ở tài khoản cũ được tạo lại ở tài khoản hiện tại khi sửa hoặc **đồng bộ lại**.
- **Chỉ lưu trong app**: Sự kiện chưa có bản sao Google vì lúc tạo chưa kết nối Google.

## Việc cần làm

- **Việc cần làm (Task)**: Một việc cần hoàn thành, có thể có hạn chót (chỉ tính theo ngày) và ghi chú; ở trạng thái **cần làm** hoặc **đã xong**. Lưu trong **danh sách việc chung** của zalobot, ghi nhận **người tạo** và nguồn (nhóm Zalo, chat riêng, dashboard hoặc Google Tasks).
- **Danh sách việc chung**: Toàn hệ thống có một danh sách việc duy nhất giống sổ chung và lịch chung; ai cũng xem được mọi việc. Đổi tài khoản Google không làm mất việc.
- **Bản sao Google (task)**: Bản chép của việc trong Google Tasks của tài khoản đang kết nối. Như với lịch, việc nhớ bản sao nằm ở tài khoản nào; bản sao ở tài khoản cũ được tạo lại ở tài khoản hiện tại khi sửa hoặc **đồng bộ lại**. Việc tạo hoặc xoá thẳng trên Google Tasks được nhập/xoá theo ở lần xem kế tiếp.

## Nhật ký kiểm toán

- **Nhật ký kiểm toán**: Bản ghi không thể thay thế về việc thêm, sửa hoặc xoá một dữ liệu, gồm dữ liệu trước/sau, thời điểm và người liên quan nếu xác định được.

## Thao tác chờ duyệt & Thu hồi tin nhắn

- **Thao tác chờ duyệt (Pending Action)**: Yêu cầu thay đổi dữ liệu nhạy cảm được cấp mã 3 số ngẫu nhiên (`code`), gắn thời hạn 5 phút và lưu vào Redis.
- **Xác nhận đa chiều**: Duyệt thao tác bằng tin nhắn (`yes <code>`), thả tim (❤️) đạt ngưỡng quy định, hoặc hủy bỏ bằng `cancel <code>` hay thả phẫn nộ (😡).
- **Thu hồi tin nhắn (Message Recall / Undo)**: Cơ chế gọi API ZCA `undo({ msgId, cliMsgId })` để thu hồi tin nhắn thẻ xác nhận chờ đối với tất cả mọi người trong phòng chat ngay khi hành động được duyệt, hủy, hết hạn hoặc chỉnh sửa.
- **Hành động đi kèm (Companion Action)**: Thao tác phụ được sinh đồng thời trong cùng một luồng (như tạo nơi chốn mới khi ghi thu chi). Khi thao tác chính được duyệt, hành động phụ được tự động cam kết và thu hồi thẻ chờ tương ứng.

## Trí nhớ hội thoại

- **Trí nhớ hội thoại**: Bản lưu mọi tin nhắn (kể cả tin bot gửi) của các kênh ZCA đang listen **và được admin bật trí nhớ** (bật riêng từng kênh, mặc định tắt), dùng để trả lời câu hỏi về chuyện đã trao đổi. Chỉ tra cứu **trong đúng kênh đang hỏi**; tin bị thu hồi thì bị xoá nội dung khỏi trí nhớ.
- **Cửa sổ ngữ cảnh ngắn hạn**: Vài tin gần nhất của kênh được đưa vào prompt để bot hiểu câu nối tiếp; bot không thực hiện lại các yêu cầu cũ nằm trong đó.

## ZCA & Phân vùng lưu trữ Drive

- **Chủ hệ thống (`dashboard-owner`)**: Tài khoản admin không gắn với ID Zalo nào, được dùng khi đăng nhập dashboard bằng mã cố định `DASHBOARD_LOGIN_CODE` trong env; mỗi lần đăng nhập đều được trả lại quyền admin.
- **ZCA (Zalo Client Account)**: Kết nối tài khoản cá nhân Zalo qua giao thức WebSocket và quét mã QR, cho phép bot tham gia các nhóm chat như người dùng thật.
- **Kênh (Thread / Channel)**: Một cuộc trò chuyện cá nhân (`user`) hoặc nhóm chat (`group`) trên Zalo, có ID nguyên bản (`channelId`) độc lập.
- **Danh tính kênh Zalo**: Cùng một người có thể có nhiều ID: ID theo app của Zalo Bot chính thức đã bỏ (webhook, 20 ký tự hex, chỉ còn ở dữ liệu cũ) và UID Zalo cá nhân qua ZCA (dạng số). Hệ thống chỉ coi `users.id` là danh tính.
- **Gộp tài khoản (User Merge)**: Thao tác của admin chuyển dấu vết của một ID trùng (người tạo giao dịch, liên kết người liên quan, lời nhắc, token Google) sang người dùng giữ lại, rồi xoá ID trùng. Dữ liệu tài chính là sổ chung nên không phải di chuyển. Chạy trong một transaction và không thể hoàn tác.
- **Tài khoản lưu trữ dùng chung**: Tài khoản Google mà admin đăng nhập gần nhất qua `/login`; mọi media của các kênh được lưu vào đây. Việc tự làm mới token không làm đổi tài khoản này.
- **Lịch sử nơi lưu trữ**: Danh sách mọi thư mục Drive gốc và album Photos mà một kênh từng dùng, kèm tài khoản Google và thời gian dùng. Đổi tài khoản thì link cũ vẫn còn trong danh sách.
- **Phân vùng lưu trữ (Drive Partition)**: Thư mục Google Drive được tạo riêng biệt cho từng kênh theo quy chuẩn `zalobot/<channelId>/<category>` (`bill`, `image`, `video`, `file`, `audio`).

