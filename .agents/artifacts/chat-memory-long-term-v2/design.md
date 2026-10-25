# Thiết kế: Trí nhớ dài hạn v2 theo từng kênh ZCA

Route: research · Authority: research-only · Ngày: 2026-10-25 · Trạng thái: đề xuất, chưa phải implementation plan

Liên quan: `.agents/artifacts/chat-memory-persona-forgetting/investigation.md` (lỗi "mèo đen"), `.agents/artifacts/chat-memory-cognee/research.md` (đánh giá Cognee, bản 2 đã kiểm chứng: spike trước giai đoạn 2), `.agents/knowledge/modules/zca/chat-memory.md` (hiện trạng).

## 1. Mục tiêu anh Đạt đã chọn

1. Nhớ mãi điều được dặn.
2. Hỏi lại chuyện cũ tốt hơn, kể cả câu hỏi tổng hợp.
3. Tự hiểu về người trong nhóm mà không cần ai dặn.
4. Lưu mãi, không xoá tin cũ.

## 2. Quyết định đã chốt (2026-10-25)

| # | Quyết định | Hệ quả |
| --- | --- | --- |
| Q1 | AI chạy đêm dùng **9router như hiện tại** (dự phòng Gemini) | Toàn bộ chat trong ngày của kênh bật dài hạn được gửi tới model ở phía sau 9router (hiện là DeepSeek miễn phí), kể cả tin của người không dùng bot. Phải sửa ngoại lệ trong `global/local-first-ai-usage.md` và cảnh báo rõ trên dashboard khi admin bật. |
| Q2 | Điều tự học được **dùng ngay, xoá được** | Không cần admin duyệt. Admin xem và xoá trên dashboard; trong chat nói "quên …" thì hiện thẻ xác nhận xoá. Ghi nhớ (điều được dặn) luôn thắng điều tự học. |
| Q3 | Tin bị thu hồi **vẫn xoá khỏi trí nhớ** | Giữ quy tắc trong `CONTEXT.md`. Tóm tắt và điều tự học rút ra từ tin đó cũng phải xoá hoặc làm lại. |

## 3. Kiến trúc: bốn tầng, cùng nằm trong Postgres, chia theo kênh

Không thêm service hay kho dữ liệu mới. Lịch chạy đêm dùng BullMQ `upsertJobScheduler` như job quét nhắc nhở (`apps/api/src/queue/reminder-job.ts:50`).

| Tầng | Lưu gì | Nạp vào prompt khi nào | Ai ghi |
| --- | --- | --- | --- |
| **Ghi nhớ** | Điều được dặn: tính cách bot, quy ước nhóm (≤20 dòng, mỗi dòng ≤200 ký tự) | **Mọi lượt**, ngay sau câu danh tính | Người trong kênh qua thẻ xác nhận; admin trên dashboard |
| **Hiểu về người** | Fact về từng người trong kênh, và về bot ("bot là mèo đen 2 mái") | Mọi lượt: fact về bot, về người gửi, về người được tag, và về người có trong cửa sổ gần đây (giới hạn ~15 dòng) | Job chạy đêm |
| **Nhật ký ngày/tháng** | Tóm tắt từng ngày, gộp thành từng tháng | Khi tra chuyện cũ (`SEARCH_CHAT_HISTORY`) | Job chạy đêm và đầu tháng |
| **Tin gốc** | `zca_messages`, giữ mãi (trừ tin bị thu hồi) | Cửa sổ gần đây ở mọi lượt; đoạn tìm được khi tra | Ghi trực tiếp lúc nhận tin, như hiện tại |

### 3.1 Ghi nhớ (sửa lỗi "mèo đen")

- Bảng mới, ví dụ `zca_channel_notes`: `channel_id`, `text`, `created_by`, `source_msg_id`, `created_at`.
- Tool mới `REMEMBER_NOTE` / `FORGET_NOTE`, chạy khi có người nói "nhớ nhé", "tao dặn rồi", "từ giờ mày là…", "quên vụ … đi". Cả hai đi qua thẻ xác nhận như các thao tác khác. Dòng mới cùng chủ đề với dòng cũ thì thẻ đề xuất thay dòng cũ.
- Trên trang cấu hình kênh: xem, thêm, sửa, xoá.
- Prompt ở cả hai lượt gọi AI (`text-input.service.ts:190` và `:603`): chèn khối Ghi nhớ ngay sau câu danh tính, kèm chỉ dẫn "các điều được dặn ưu tiên hơn mô tả mặc định".
- Ghi nhớ không phụ thuộc vào trí nhớ dài hạn. Kênh tắt dài hạn vẫn dùng được.

### 3.2 Hiểu về người (tự học)

- Bảng mới, ví dụ `zca_channel_facts`: `channel_id`, `subject_kind` (`bot` | `member`), `subject_user_id` (nếu xác định được), `subject_name`, `fact`, `source_msg_ids`, `learned_at`, `updated_at`.
- Job chạy đêm gửi cho AI: chat trong ngày, danh sách thành viên của kênh, các fact hiện có của kênh. AI trả về các thao tác thêm/sửa/xoá fact. Ví dụ: "Hằng ăn chay" (thêm), "Đạt đổi chỗ làm" (sửa fact cũ).
- Dặn AI bỏ qua câu chửi, câu đùa, đe doạ ("cút lên mái nhà", "tao thiến mày"), và chỉ giữ thông tin ổn định.
- Bắt được cả trường hợp người dùng không nói "nhớ nhé": câu "mày là con mèo đen 2 mái" sẽ thành một fact về bot, chậm tối đa một ngày.
- Dùng ngay (Q2). Dashboard có danh sách "Bot đã học" với nút xoá, chat "quên …" thì hiện thẻ xác nhận. Prompt ghi rõ các fact này là bot tự rút ra nên có thể sai.

### 3.3 Nhật ký ngày/tháng (hỏi chuyện cũ tốt hơn)

- Bảng mới, ví dụ `zca_channel_digests`: `channel_id`, `period` (`day` | `month`), `period_start`, `summary`, `search_vector`, `stale`.
- 03:00 giờ Việt Nam: với mỗi kênh bật dài hạn và có tin hôm qua, gọi AI một lần để lấy cả tóm tắt ngày và các thao tác fact. Ngày quá dài (ví dụ trên 400 tin) thì chia nhỏ rồi gộp lại.
- Ngày 1 hằng tháng: gộp tóm tắt các ngày thành một tóm tắt tháng.
- `SEARCH_CHAT_HISTORY` tra cả tóm tắt lẫn tin gốc rồi đưa cả hai cho AI trả lời. Câu "cả năm đi những đâu" đọc 12 tóm tắt tháng thay vì hàng chục nghìn tin.

### 3.4 Tin gốc và trí nhớ ngắn hạn

- Giữ `zca_messages` vô hạn như hiện tại (mục tiêu 4).
- Cửa sổ gần đây đọc thẳng từ `zca_messages` (index `(channel_id, sent_at DESC)` đã có), bỏ danh sách Redis `zca:short_memory:*`.
- Thêm cột loại tin để bỏ thẻ xác nhận, thông báo "Hết hạn" và tin chứa link dashboard ra khỏi cửa sổ và khỏi tóm tắt.
- Kênh chỉ bật ngắn hạn: cần quy định giữ tin (cột `expires_at` + job xoá) để vẫn đúng lời hứa "1–7 ngày".

### 3.5 Thu hồi (Q3)

- Tin gốc: như hiện tại (`markRecalled`).
- Tóm tắt của ngày có tin bị thu hồi: đánh dấu `stale`, đêm sau làm lại ngày đó và tháng chứa ngày đó.
- Fact có `source_msg_ids` chứa tin bị thu hồi: xoá nếu đó là nguồn duy nhất; còn nguồn khác thì để đêm sau AI xem lại.

## 4. Quyền riêng tư và chi phí (theo Q1)

- Dữ liệu gửi đi: chữ của tin (không gửi link media), loại bỏ tin đã thu hồi và các tin hệ thống ở mục 3.4.
- Rủi ro anh đã chấp nhận: model miễn phí của bên thứ ba có thể dùng dữ liệu để train; tin của cả người không dùng bot cũng bị gửi đi. Dashboard cần cảnh báo điều này ngay ở công tắc bật trí nhớ dài hạn.
- Đường lui: đổi `LLM_PROVIDER` sang `qwen` để chạy hoàn toàn trên máy, không phải đổi code.
- Chi phí: mỗi kênh 1–3 lượt gọi một đêm, thêm 1 lượt đầu tháng. Chạy lần lượt từng kênh, có retry/backoff để không chạm giới hạn của model miễn phí.

## 5. Chia giai đoạn

| Giai đoạn | Nội dung | Kết quả thấy được |
| --- | --- | --- |
| **1** | Ghi nhớ (bảng, tool, thẻ xác nhận, dashboard, prompt); chuyển ngắn hạn sang `zca_messages`; cột loại tin; gộp giao diện thành mục "Trí nhớ" | Hết lỗi "mèo đen"; 15 tin trong cửa sổ đều là tin hội thoại thật |
| **2** | Job chạy đêm: tóm tắt ngày + Hiểu về người; xử lý thu hồi; danh sách "Bot đã học" trên dashboard; cập nhật ngoại lệ trong chính sách local-first | Bot tự biết "Hằng ăn chay"; câu hỏi chuyện cũ có tóm tắt để dựa vào |
| **3** | Gộp tháng; tra cứu dùng tóm tắt; đo các câu trả lời sai trên dữ liệu thật; cân nhắc pgvector nếu cần | Trả lời được câu tổng hợp theo tháng/năm |

Mỗi giai đoạn có implementation plan riêng và chờ anh duyệt trước khi sửa code.

Trước giai đoạn 2: chạy spike Cognee theo tiêu chí ở `.agents/artifacts/chat-memory-cognee/research.md` mục 6. Đạt thì tầng "Hiểu về người" và "Nhật ký" dùng Cognee; không đạt thì tự làm như mô tả ở mục 3.2–3.3.

## 6. Rủi ro còn mở

- Chất lượng tóm tắt và rút fact bằng tiếng Việt của model miễn phí sau 9router chưa được đo. Nên chạy thử trên một ngày chat thật trước khi bật cho mọi kênh.
- Gắn fact đúng người: "chồng Hằng", "@den", "Đạt" phải được map về đúng `users.id`. AI có thể nhầm; fact xoá được nên chấp nhận được.
- Ranh giới giữa đùa và thật trong nhóm gia đình rất mờ. Cần một vài tuần dùng thật để chỉnh câu dặn trong prompt.
