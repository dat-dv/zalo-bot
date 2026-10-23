# Ubiquitous language

## Thu–chi

- **Giao dịch**: Một khoản tiền đã phát sinh, thuộc **sổ chung** của cả hệ thống và ghi nhận **người tạo**.
- **Khoản thu**: Giao dịch làm tăng tiền nhận được, ví dụ lương, hoàn tiền hoặc bán hàng.
- **Khoản chi**: Giao dịch làm giảm tiền đã dùng, ví dụ ăn uống, đi lại hoặc mua sắm.
- **Số tiền**: Giá trị dương, lưu bằng đồng Việt Nam (VND), không lưu đơn vị nghìn hoặc triệu.
- **Danh mục**: Nhãn ngắn để nhóm giao dịch, chẳng hạn `Ăn uống`, `Đi lại`, `Lương`; khi không rõ dùng `Khác`.
- **Ngày phát sinh**: Thời điểm giao dịch xảy ra. Nếu người dùng không nêu, mặc định là thời điểm họ nhắn bot.

- **Sổ chung**: Toàn hệ thống chỉ có một kho tài chính (thu chi, nơi chốn, danh bạ công nợ, công nợ, danh mục), không thuộc về người dùng nào; ai nhắn bot hay thao tác trên dashboard cũng ghi vào và xem toàn bộ kho này. Không có sổ riêng theo người dùng.
- **Người tạo**: Người đã ghi giao dịch (người gửi tin Zalo hoặc người dùng dashboard), kèm **nguồn** (nhóm Zalo, chat riêng hoặc dashboard). Không dùng để giới hạn ai được xem dữ liệu; chỉ dùng khi người dùng chủ động chọn xem (bộ lọc người tạo ở bảng thu chi, giao dịch do họ ghi trên **hồ sơ**).

## Công nợ

- **Khoản phải thu**: Tiền người khác đang nợ người dùng, thường phát sinh khi người dùng cho mượn.
- **Khoản phải trả**: Tiền người dùng đang nợ người khác, thường phát sinh khi người dùng vay hoặc mua chịu.
- **Người liên quan**: Người cho vay hoặc người đi vay của một khoản nợ.
- **Biệt danh**: Nhãn phân biệt một người liên quan trùng tên với người khác, ví dụ `Trí (Trí Đen)`.
- **Danh bạ công nợ**: Tập người liên quan dùng chung cho cả hệ thống. Mỗi người có một mã cố định; việc tra cứu dùng khóa tên/biệt danh đã chuẩn hoá và so khớp chính xác, không tìm gần đúng bằng `LIKE`.
- **Liên kết tài khoản**: Gắn một Người liên quan với đúng một người dùng zalo của hệ thống (`users.id`). Chỉ admin được gắn/bỏ gắn; trong danh bạ chung, mỗi người dùng chỉ gắn với tối đa một Người liên quan.
- **Lưu dự phòng số điện thoại**: Người liên quan và người dùng zalo đã liên kết bù số điện thoại cho nhau, chỉ điền khi bên kia đang trống, không ghi đè.
- **Số còn lại**: Phần tiền chưa được trả; khoản nợ chỉ hoàn tất khi số này bằng 0.
- **Hồ sơ**: Trang gom mọi thông tin về một Người liên quan và người dùng zalo đã liên kết với họ (nếu có): SĐT và tài khoản chính/phụ, ngày sinh, quan hệ, địa chỉ, nơi làm việc, ghi chú, cùng các khoản nợ của họ và các giao dịch gắn với họ hoặc do tài khoản Zalo đã liên kết của họ ghi (mỗi giao dịch tính một lần). Gốc của hồ sơ là Người liên quan; người dùng zalo chưa có Người liên quan thì admin tạo hồ sơ để tạo và liên kết.

## Lịch

- **Sự kiện lịch**: Một cuộc hẹn hoặc việc có giờ giấc, lưu trong **lịch chung** của zalobot, ghi nhận **người tạo** và nguồn (nhóm Zalo, chat riêng, dashboard hoặc Google Calendar).
- **Lịch chung**: Toàn hệ thống có một lịch duy nhất giống sổ chung; ai cũng xem được mọi sự kiện. Đổi tài khoản Google không làm mất sự kiện.
- **Sự kiện cả ngày**: Sự kiện không có giờ; ngày kết thúc được lưu là nửa đêm sau ngày cuối (như Google Calendar).
- **Bản sao Google**: Bản chép của sự kiện trong Google Calendar của tài khoản đang kết nối, để điện thoại nhận nhắc. Mỗi sự kiện nhớ bản sao nằm ở tài khoản nào; bản sao ở tài khoản cũ được tạo lại ở tài khoản hiện tại khi sửa hoặc **đồng bộ lại**.
- **Chỉ lưu trong app**: Sự kiện chưa có bản sao Google vì lúc tạo chưa kết nối Google.

## Việc cần làm

- **Việc cần làm (Task)**: Một việc cần hoàn thành, có thể có hạn chót (chỉ tính theo ngày) và ghi chú; ở trạng thái **cần làm** hoặc **đã xong**. Lưu trong **danh sách việc chung** của zalobot, ghi nhận **người tạo** và nguồn (nhóm Zalo, chat riêng hoặc dashboard). Chỉ lưu trong zalobot, không đồng bộ với Google Tasks.
- **Danh sách việc chung**: Toàn hệ thống có một danh sách việc duy nhất giống sổ chung và lịch chung; ai cũng xem được mọi việc. Không cần kết nối Google.
- **Nhắc việc**: Một hoặc nhiều **lần nhắc** gắn với một việc: đến mỗi giờ đã đặt, nếu việc vẫn **cần làm** thì bot gửi tin nhắc tới **đích nhắc**. Việc đã xong hoặc đã xoá thì không nhắc. Mỗi lần nhắc có thể **lặp lại**, và việc có thể **nhắc lại** tới khi xong. Khác **lời nhắc** cá nhân (không gắn việc, mặc định gửi chat riêng).
- **Lời nhắc đã xong**: Lời nhắc không còn lần nhắc nào chờ gửi, hoặc đã được bấm Đã xong. Vẫn được giữ để xem lại (tab Đã xong) cho tới khi người dùng xoá; thêm giờ nhắc mới ở tương lai thì nó quay lại chờ gửi. Lời nhắc có lần nhắc lặp lại thì không bao giờ tự xong.
- **Lần nhắc**: Một giờ nhắc của một việc hoặc một lời nhắc, gửi đúng một lần, hoặc **lặp lại** theo kiểu lặp riêng của nó (gửi xong thì tự dời sang lần kế tiếp). Mỗi việc hoặc lời nhắc có tối đa 10 lần nhắc; sửa danh sách thì lần nào giữ nguyên vẫn giữ dấu đã gửi.
- **Lặp lại**: Kiểu lặp riêng của từng lần nhắc: không lặp, hằng ngày, ngày thường (thứ 2 đến thứ 6), hằng tuần (vào các thứ đã chọn, không chọn thì đúng thứ của lần nhắc), hằng tháng (cùng ngày, tháng ngắn hơn thì ngày cuối tháng). Tính theo giờ Việt Nam; lần bị lỡ không gửi bù.
- **Nhắc lại**: Sau mỗi lần nhắc, bot nhắc thêm mỗi X phút/giờ (5 phút đến 24 giờ), tối đa N lần (1–10). Dùng chung cho mọi lần nhắc của một việc hoặc lời nhắc; dừng khi việc xong hay lời nhắc được bấm Đã xong. Phải kết thúc trước lần lặp kế tiếp.
- **Đích nhắc**: Nơi và người nhận một lần nhắc (nhắc việc hoặc lời nhắc): **kênh nhận nhắc**, **người được nhắc** và **cách nhắc**. Dùng chung cho nhắc việc và lời nhắc, áp cho mọi lần nhắc. Đổi đích chỉ áp cho các lần chưa gửi, không gửi lại lần đã gửi.
- **Kênh nhận nhắc**: Cuộc trò chuyện Zalo nhận nhắc. Mặc định: nhắc việc → nơi đã nhắn bot tạo việc; lời nhắc → chat riêng của người tạo; trên dashboard → chat riêng của người dùng. Chọn kênh khác thì phải là kênh đang listen. Chủ hệ thống, và người dùng chỉ có ID Zalo Bot cũ (ZCA không nhắn tới được), không có chat riêng nên phải tự chọn.
- **Người được nhắc**: Ai nhận một lần nhắc; khi có nhắc thì bắt buộc phải có. Nhóm: thành viên được chọn, 1–10 người. Chat riêng: chính người của chat đó. Trên Zalo lấy từ người được tag trong tin, không đoán theo tên; nhắc trong nhóm mà không tag ai thì là người nhắn.
- **Cách nhắc**: Tag người được nhắc trong nhóm (mặc định), hoặc nhắn riêng từng người; ai không nhắn riêng được thì được tag bù trong nhóm.

## Nhật ký kiểm toán

- **Nhật ký kiểm toán**: Bản ghi không thể thay thế về việc thêm, sửa hoặc xoá một dữ liệu, gồm dữ liệu trước/sau, thời điểm, **người thực hiện**, **nguồn** và kênh Zalo nếu có. Admin xem trên trang **Nhật ký hoạt động**.
- **Người thực hiện**: Người gây ra thay đổi, không phải người đã tạo bản ghi: người dùng dashboard, người nhắn bot trên Zalo, hoặc người yêu cầu của một thao tác chờ duyệt (không phải người bấm duyệt). Việc tự động (gửi nhắc, nhập lịch từ Google) có người thực hiện là **hệ thống**. Không xác định được thì để trống, không đoán.
- **Dữ liệu cũ (nhật ký)**: Dòng nhật ký ghi trước khi hệ thống lưu người thực hiện; người hiển thị là người tạo bản ghi, có thể không phải người sửa.

## Thao tác chờ duyệt & Thu hồi tin nhắn

- **Thao tác chờ duyệt (Pending Action)**: Yêu cầu thay đổi dữ liệu nhạy cảm được cấp mã 3 số ngẫu nhiên (`code`), gắn thời hạn 5 phút và lưu vào Redis.
- **Xác nhận đa chiều**: Duyệt thao tác bằng tin nhắn (`yes <code>`), thả tim (❤️) đạt ngưỡng quy định, hoặc hủy bỏ bằng `cancel <code>` hay thả phẫn nộ (😡).
- **Thu hồi tin nhắn (Message Recall / Undo)**: Cơ chế gọi API ZCA `undo({ msgId, cliMsgId })` để thu hồi tin nhắn thẻ xác nhận chờ đối với tất cả mọi người trong phòng chat ngay khi hành động được duyệt, hủy, hết hạn hoặc chỉnh sửa.
- **Hành động đi kèm (Companion Action)**: Thao tác phụ được sinh đồng thời trong cùng một luồng (như tạo nơi chốn mới khi ghi thu chi). Khi thao tác chính được duyệt, hành động phụ được tự động cam kết và thu hồi thẻ chờ tương ứng.

## Trí nhớ hội thoại

- **Trí nhớ hội thoại**: Gồm hai loại độc lập, admin bật riêng từng loại cho từng kênh ZCA đang listen (mặc định tắt cả hai); tắt loại này không tắt loại kia. Tin bị thu hồi thì bị xoá khỏi cả hai.
- **Trí nhớ dài hạn**: Bản lưu lâu dài mọi tin nhắn (kể cả tin bot gửi) của kênh, dùng để trả lời câu hỏi về chuyện đã trao đổi. Chỉ tra cứu **trong đúng kênh đang hỏi**.
- **Trí nhớ ngắn hạn (cửa sổ ngữ cảnh)**: Vài tin gần nhất của kênh được đưa vào prompt ở mỗi lượt để bot hiểu câu nối tiếp; chỉ dùng tin gửi trong số ngày admin chọn cho kênh (1–7 ngày, mặc định 1), tin cũ hơn tự bị quên. Bot không thực hiện lại các yêu cầu cũ nằm trong đó.
- **Chữ trong ảnh**: Chữ bot tự đọc (OCR ngay trên server) từ ảnh gửi vào kênh, kể cả ảnh không gọi bot, rồi nhớ cùng tin ảnh đó trong các trí nhớ đang bật. Admin bật/tắt riêng cho từng kênh (mặc định bật, chỉ có tác dụng khi kênh bật ít nhất một loại trí nhớ). Ảnh không có chữ rõ ràng thì chỉ được nhớ là ảnh.

## ZCA & Phân vùng lưu trữ Drive

- **Chủ hệ thống (`dashboard-owner`)**: Tài khoản admin không gắn với ID Zalo nào, được dùng khi đăng nhập dashboard bằng mã cố định `DASHBOARD_LOGIN_CODE` trong env; mỗi lần đăng nhập đều được trả lại quyền admin.
- **ZCA (Zalo Client Account)**: Kết nối tài khoản cá nhân Zalo qua giao thức WebSocket và quét mã QR, cho phép bot tham gia các nhóm chat như người dùng thật.
- **Kênh (Thread / Channel)**: Một cuộc trò chuyện cá nhân (`user`) hoặc nhóm chat (`group`) trên Zalo, có ID nguyên bản (`channelId`) độc lập.
- **Quyền toàn cục**: Quyền dùng bot của một người dùng zalo (`grantAccess`), admin cấp trên trang Zalo & Người dùng; có hiệu lực ở mọi kênh.
- **Quyền theo kênh**: Quyền gọi bot (mention hoặc tiền tố) chỉ trong một nhóm, admin cấu hình trên trang cấu hình kênh: không ai thêm, mọi thành viên, hoặc thành viên được chọn. Cộng thêm vào quyền toàn cục, không thu hồi quyền toàn cục; không tự cấp quyền toàn cục.
- **Danh tính kênh Zalo**: Cùng một người có thể có nhiều ID: ID theo app của Zalo Bot chính thức đã bỏ (webhook, 20 ký tự hex, chỉ còn ở dữ liệu cũ) và UID Zalo cá nhân qua ZCA (dạng số). Hệ thống chỉ coi `users.id` là danh tính.
- **Gộp tài khoản (User Merge)**: Thao tác của admin chuyển dấu vết của một ID trùng (người tạo giao dịch, việc cần làm và sự kiện lịch, liên kết người liên quan, lời nhắc, đích nhắc trỏ tới ID trùng, token Google) sang người dùng giữ lại, rồi xoá ID trùng. Dữ liệu tài chính là sổ chung nên không phải di chuyển. Chạy trong một transaction và không thể hoàn tác.
- **Tài khoản lưu trữ dùng chung**: Tài khoản Google mà admin đăng nhập gần nhất qua `/login` hoặc trên dashboard (trang Google Drive); mọi media của các kênh được lưu vào đây. Việc tự làm mới token không làm đổi tài khoản này. Admin đăng xuất thì hệ thống không còn tài khoản lưu trữ nào cho tới khi có người đăng nhập lại, không tự chuyển sang tài khoản Google khác.
- **Lịch sử nơi lưu trữ**: Danh sách mọi thư mục Drive gốc và album Photos mà một kênh từng dùng, kèm tài khoản Google và thời gian dùng. Đổi tài khoản thì link cũ vẫn còn trong danh sách. Admin có thể thêm tay link một thư mục hoặc album có sẵn (không tạo gì trên Google, không đổi nơi lưu media mới); không thêm được link đã có.
- **Phân vùng lưu trữ (Drive Partition)**: Thư mục Google Drive được tạo riêng biệt cho từng kênh theo quy chuẩn `zalobot/<channelId>/<category>` (`bill`, `image`, `video`, `file`, `audio`).

