# Chẩn đoán: bot không nhớ chuyện vừa nói trong ngày (26/10/2026)

## Hiện tượng (đoạn chat nhóm, mật khẩu đã lược bỏ)
- 14:28: Văn Đạt gửi ba tin riêng lẻ: `c.datintech.site`, `admin`, `mk : <mật khẩu>`.
- 14:55:15: "@den chỉ hằng biết tài khoản admin của website c.datintech.site". Bot trả lời kiểu trò chuyện, theo tính cách mèo đen: "không bới ra được đâu".
- 14:55:36: "@den lúc nãy a có nói r". Bot trả lời "Không thấy đoạn tin nhắn nào nói về nội dung này trong lịch sử trò chuyện". Câu này là kết quả của `SEARCH_CHAT_HISTORY`, tức kênh có bật Nhớ lâu dài.

## Nguyên nhân (theo thứ tự ảnh hưởng)
1. **Câu đầu không được hiểu là câu hỏi chuyện cũ.**
   - Câu đầu là lời nhờ "chỉ cho Hằng biết …", không phải câu hỏi kiểu "hôm trước … gì".
   - Bảng phân loại ý định (`INTENT_CLASSIFICATION_RULES`) không có mẫu nào như vậy, nên AI chọn trò chuyện và không gọi tool tra cứu.
2. **Câu thứ hai không có ngữ cảnh.**
   - "lúc nãy a có nói r" không nói đã nói về chuyện gì.
   - Từ commit `db8ff3dc` hôm nay, bot không còn đưa tin gần đây vào prompt, nên AI không biết câu ngay trước đó là chuyện tài khoản admin.
   - Không có ngữ cảnh thì từ khoá AI sinh ra rất chung chung, không khớp tin nào.
   - Nếu prod chưa deploy bản này thì nguyên nhân là kênh chưa bật "Nhớ đoạn chat gần đây" cũ (mặc định tắt). Kết quả như nhau.
3. **Tìm theo từ khoá dễ trượt với kiểu tin này.** Đã kiểm tra trên Postgres local với cấu hình `simple` giống prod:
   - `c.datintech.site` được lưu thành **một token**. Tìm `datintech` không khớp (`f`); chỉ đúng nguyên chuỗi `c.datintech.site` mới khớp.
   - Mỗi từ khoá nhiều chữ là phép AND (`plainto_tsquery`): "tài khoản admin" **không** khớp tin chỉ có chữ "admin". Chỉ từ khoá đơn "admin" mới khớp.
   - Người ta hay viết tắt: tin ghi "mk", không ghi "mật khẩu".
4. **Cognee chưa có dữ liệu hôm nay.** Tin trong ngày chỉ được nạp vào Cognee lúc 03:00 đêm nay, nên chỉ còn trông vào tìm theo từ khoá.

## Lưu ý bảo mật
- Mật khẩu admin của `c.datintech.site` đã nằm trong chat nhóm, trong bảng `zca_messages`.
- Nếu kênh bật Nhớ lâu dài, mật khẩu sẽ được gửi tới LLM của Cognee (9router) trong đợt nạp đêm nay. Bộ che chỉ che dãy số từ 12 chữ số trở lên, không che mật khẩu.
- Nên đổi mật khẩu này. Nên cân nhắc có muốn bot nhắc lại thông tin đăng nhập trong nhóm hay không.

## Hướng sửa đề xuất (chờ anh chọn)
- **A. Ngữ cảnh lượt trước, không cấu hình**: đưa 1–2 lượt hỏi đáp gần nhất **của chính người nhắn với bot** (trong ~10 phút) vào prompt, để hiểu câu nối tiếp như "lúc nãy a có nói r". Phương án này mở lại một phần trí nhớ ngắn hạn vừa bỏ, ở mức tối thiểu và không có ô cấu hình.
- **B. Tìm theo từ khoá bền hơn**:
  - Tách từ khoá nhiều chữ thành từng chữ, nối bằng OR, xếp hạng theo số chữ khớp.
  - Thêm tìm `ILIKE` cho từ khoá có dấu chấm hoặc gạch (tên miền, email).
  - Prompt nhắc AI thêm từ viết tắt (mk, pass, tk).
- **C. Phân loại ý định**: thêm mẫu "chỉ/nói cho X biết <thông tin>" và "lúc nãy nói rồi" → `SEARCH_CHAT_HISTORY` khi kênh bật Nhớ lâu dài.
- **D. Thông tin nhạy cảm**: che mật khẩu ("mk:", "pass:", "password") trước khi nạp Cognee. Có thể cả trước khi lưu, tuỳ anh quyết định.
