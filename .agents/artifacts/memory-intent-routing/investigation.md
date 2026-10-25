# Chẩn đoán: bot không biết cái nào nên lưu (Ghi nhớ / việc cần làm / lời nhắc)

Ngày: 2026-10-26 · Route: investigate · Authority: propose-only

## Hiện tượng (chat 26/10, 00:10–00:16)

1. "@Đen mày là con gì" → "dạ em là trợ lý của sếp" (lúc này chưa có Ghi nhớ nào, nên trả lời đúng theo thiết kế).
2. "@den mày là con mèo đen 2 mái 10 tuổi" → bot hiện thẻ "Ghi nhớ [173]?".
3. Không ai duyệt → 00:16 "[173] Hết hạn, chưa lưu". Lời dặn mất.

## Kết luận

Bot **nhận đúng ý** (gọi `REMEMBER_NOTE`), nhưng thiết kế bắt **mọi Ghi nhớ phải qua thẻ duyệt 5 phút** (mặc định C14 trong plan v2). Với lời dặn kiểu "mày là con mèo đen", người dùng không hiểu vì sao phải duyệt, không duyệt, nên lời dặn bị bỏ. Đây là lỗi do em đặt thiết kế quá chặt, không phải AI chọn sai tool.

Nguyên nhân đi kèm (từ code, chưa có ví dụ thật):
- `text-input.service.ts:251` gọi `REMEMBER_NOTE` khi thấy "nhớ nhé" / "nhớ là". Trong tiếng Việt, "nhớ" thường dùng để nhờ nhắc ("nhớ nhắc chồng Hằng mua bánh tráng", "nhớ mua sữa"), đụng với `SET_REMINDER` (`:237`) và `CREATE_TASK` (`:242`). Prompt không có luật phân biệt và không có ví dụ đối chiếu.
- Ranh giới `SET_REMINDER` và `CREATE_TASK` (có `remindAt`) vốn đã mờ từ trước: cả hai đều nhắc theo giờ. Prompt chỉ phân biệt bằng ví dụ, không có luật.
- Hệ thống có tới bốn tầng trí nhớ (Ghi nhớ, cửa sổ gần đây, tự học, Cognee), nhiều hơn mức cần cho một nhóm gia đình.

Chưa kiểm được: chưa chạy thử LLM với các câu mẫu, vì 9router đang trả 410 và key Gemini không được phép dùng trong phiên này. Chưa có đoạn chat thật cho trường hợp nhầm việc cần làm với lời nhắc.

## Đề xuất sửa (chưa làm)

1. **Ghi nhớ lưu ngay, không cần duyệt.** Bot trả lời "Đã nhớ: Bot là con mèo đen 2 mái 10 tuổi (nói 'quên vụ … đi' để bỏ)". Ghi nhớ chỉ đổi cách bot nói chuyện, không đụng tới tiền hay dữ liệu chung. Giới hạn 20 điều, sửa và xoá trên dashboard vẫn giữ. Quên vẫn có thể giữ thẻ, hoặc làm ngay luôn cho đồng bộ.
2. **Luật phân biệt rõ trong prompt** (một bảng, kèm ví dụ đối chiếu):
   - Có hành động + thời điểm cần báo ("nhớ nhắc…", "8h nhắc…", "mai nhớ mua…") → `SET_REMINDER`.
   - Một việc phải làm xong, có thể có hạn ("thêm việc…", "cần làm…", "việc: …") → `CREATE_TASK`; chỉ thêm `remindAt` khi người dùng nói rõ muốn được nhắc việc đó.
   - Mô tả lâu dài về bot hoặc về nhóm, không có thời điểm, không có việc phải làm ("mày là…", "từ giờ xưng…", "Hằng ăn chay") → `REMEMBER_NOTE`.
   - Bỏ "nhớ nhé" / "nhớ là" khỏi tín hiệu của `REMEMBER_NOTE`.
3. **Test hồi quy:** bộ câu mẫu tiếng Việt để kiểm tra chọn tool, chạy với LLM thật khi 9router chạy lại, cộng unit test cho strategy lưu ngay.
4. **Cân nhắc giảm tầng:** tạm tắt "Tự học về mọi người" và Cognee cho tới khi 9router ổn. Phần này không ảnh hưởng lỗi trong đoạn chat trên.
