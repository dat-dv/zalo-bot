# Implementation plan: Phân loại tin nhắn chuẩn hơn + Ghi nhớ lưu ngay

Route: implement · Phase 1 · Rủi ro: **TRUNG BÌNH** (đổi prompt và cách chọn tool cho mọi tin gọi bot) · Ngày: 2026-10-26 · Branch: `fix/memory-intent-routing` từ `main`

Chẩn đoán: `investigation.md` (cùng thư mục).

## 1. Mục tiêu

- "@den mày là con mèo đen 2 mái 10 tuổi" → bot trả lời ngay bằng giọng của nó ("dạ em nhớ rồi, em là mèo đen 2 mái 10 tuổi nè 🐈‍⬛") và **tự lưu**, không có thẻ duyệt.
- Phân biệt chuẩn bốn loại tin: **lời nhắc**, **việc cần làm**, **ghi nhớ**, **trò chuyện**.
- Có cách **đo** độ chính xác bằng bộ câu mẫu tiếng Việt, thay vì đoán.

## 2. Quyết định thiết kế

| # | Quyết định | Lý do |
| --- | --- | --- |
| K1 | **Không** thêm lượt gọi AI riêng để phân loại | Cùng một model, cùng độ mập mờ; chậm và tốn gấp đôi; đoán sai ở bước đầu là sai dây chuyền. Tool AI chọn chính là nhãn phân loại; log đã ghi `LLM resolved tool "…"`. |
| K2 | Ghi nhớ và Quên **làm ngay, không có thẻ** | Chỉ đổi cách bot nói chuyện, không đụng tiền hay dữ liệu chung; sửa, xoá được trên dashboard hoặc bằng "quên vụ … đi". |
| K3 | Tool `REMEMBER_NOTE`/`FORGET_MEMORY` có thêm trường `reply` | AI tự viết câu trả lời theo giọng của bot (tôn trọng Ghi nhớ hiện có), nên cuộc trò chuyện tự nhiên. Thiếu `reply` thì dùng câu mặc định. |
| K4 | Một khối luật **"PHÂN LOẠI TIN NHẮN"** duy nhất trong prompt, kèm cặp ví dụ dễ nhầm; mô tả tool viết lại cho khớp | Hiện các luật nằm rải rác trong từng mô tả tool và chồng lên nhau (chữ "nhớ"). |
| K5 | Bộ câu mẫu + script chạy với LLM thật | Mục tiêu ≥ 95% đúng tool trước khi deploy. |

## 3. Luật phân loại (đưa vào prompt)

Thứ tự quyết định:
1. **Lời nhắc (`SET_REMINDER`)**: người dùng muốn **được báo vào một thời điểm** (có giờ/ngày, hoặc "nhắc", "báo", "gọi dậy"). Ví dụ: "8h nhắc tắt bếp", "7h mai nhớ mua sữa", "nhớ nhắc chồng Hằng mua bánh tráng lúc 6h".
2. **Việc cần làm (`CREATE_TASK`)**: một **việc phải làm cho xong**, có thể có hạn theo ngày, không đòi báo giờ ("thêm việc…", "cần làm…", "phải…", "nhớ mua sữa" không có giờ, "mai nhớ nộp hồ sơ"). Chỉ điền `remindAt` khi người dùng **vừa thêm việc vừa nói rõ giờ nhắc**.
3. **Ghi nhớ (`REMEMBER_NOTE`)**: mô tả **lâu dài** về bot hoặc nhóm, **không có thời điểm và không có việc phải làm** ("mày là con mèo đen", "từ giờ xưng em gọi anh chị", "Hằng ăn chay", "nhà mình ăn cơm lúc 7h tối"). Câu kể "X là Y" về bot hoặc thành viên thì là Ghi nhớ, kể cả khi không có chữ "nhớ".
4. **Trò chuyện (không gọi tool)**: còn lại, gồm cả câu đùa, chửi, ra lệnh nhất thời cho bot ("cút lên mái nhà", "ở đó phơi nắng đi", "ngu à"). Những câu này **không** bao giờ là Ghi nhớ.

Chữ "nhớ" một mình không quyết định gì: "nhớ + việc + giờ" → lời nhắc; "nhớ + việc" → việc cần làm; "nhớ là/nhớ nhé + mô tả" → Ghi nhớ.

Khoảng 12 cặp ví dụ đối chiếu được đưa vào prompt, ví dụ "nhớ nhắc chồng mua bánh tráng lúc 6h" (lời nhắc) đặt cạnh "nhớ là chồng Hằng thích bánh tráng" (Ghi nhớ).

## 4. Thay đổi

### 4.1 Ghi nhớ và Quên làm ngay (`apps/api/src/zca/text/strategies/`)
- `REMEMBER_NOTE { text, reply?, replaceNoteId? }`:
  - Strategy lưu thẳng bằng `ChannelNotesService` (thêm mới, hoặc thay dòng `[nX]`), ghi một dòng `action` "(đã duyệt) Đã ghi nhớ: …" vào trí nhớ của kênh (chỉ khi kênh có bật trí nhớ), rồi gửi `reply` hoặc câu mặc định "Dạ em nhớ rồi: …".
  - Trùng với điều đã có: không lưu lại, vẫn trả lời "nhớ rồi".
  - Đủ 20 điều: trả lời rằng phải xoá bớt.
- `FORGET_MEMORY { query, reply? }`: xoá ngay các Ghi nhớ và điều tự học khớp (tối đa 5); khớp nhiều hơn 5 thì hỏi lại cho rõ; không khớp thì nói không tìm thấy; trả lời bằng `reply` hoặc câu mặc định liệt kê những gì đã quên.
- Gỡ pending action `REMEMBER_NOTE`/`FORGET_MEMORY` khỏi `TransactionConfirmationService` cùng descriptor, tóm tắt và test liên quan. Thẻ cũ còn trong Redis sẽ tự hết hạn sau 5 phút.
- Trả lời Ghi nhớ gửi với loại `bot_chat`, như một câu trò chuyện bình thường.

### 4.2 Prompt và mô tả tool (`text-input.service.ts`, `text-tool.definitions.ts`)
- Tách phần dựng system prompt của lượt gọi tool thành hàm thuần `buildToolSystemInstruction(...)` (cùng file hoặc `text-system-prompt.ts`), để script đánh giá dùng đúng prompt đó.
- Thêm khối "PHÂN LOẠI TIN NHẮN" (mục 3) thay cho các dòng "Về nhắc nhở / Về việc cần làm / Về ghi nhớ" đang chồng nhau.
- Viết lại mô tả `SET_REMINDER`, `CREATE_TASK`, `REMEMBER_NOTE`, `FORGET_MEMORY` theo đúng luật đó. Bỏ "nhớ nhé" / "nhớ là" khỏi tín hiệu của Ghi nhớ; thêm trường `reply` có mô tả "trả lời ngắn theo đúng tính cách đã được dặn".

### 4.3 Đánh giá (`apps/api/src/zca/text/intent-eval/`)
- `intent-eval.cases.ts`: khoảng 40 câu tiếng Việt kèm tool mong đợi (hoặc "không gọi tool"). Gồm các câu trong hai đoạn chat thật 25–26/10 và các cặp dễ nhầm ở mục 3.
- `apps/api/scripts/eval-intent.ts` + `npm run eval:intent --workspace @zalobot/api`: gọi `LlmService` thật với prompt và tool y như bot, in bảng đúng/sai và tỉ lệ. Không gửi tin Zalo, không ghi DB.
- Unit test (không cần LLM): bộ câu mẫu hợp lệ (mỗi câu có đúng một kết quả mong đợi, tool tồn tại), prompt có khối phân loại, strategy Ghi nhớ/Quên lưu ngay, trùng, đủ 20, `reply` thiếu → câu mặc định.

### 4.4 Tài liệu
- `CONTEXT.md`: **Ghi nhớ** không còn qua thao tác chờ duyệt.
- `modules/zca/chat-memory.md` (EN + VI): Ghi nhớ lưu ngay, `reply`.
- `global/zalo-command-intake.md` (EN + VI): luật phân loại bốn loại tin và cách chạy bộ đánh giá.

## 5. Kiểm thử

- `npm run typecheck|lint:check|test --workspace @zalobot/api`; `node .claude/hooks/docs-drift-check.mjs`.
- `npm run eval:intent`: **chưa chạy được ngay**, vì 9router đang trả 410 và key Gemini không được dùng trong phiên này. Khi anh sửa 9router (hoặc cho em dùng Gemini), em chạy và chỉnh prompt tới ≥ 95% rồi mới deploy. Em sẽ ghi rõ nếu chưa đo được.

## 6. Rủi ro

| Rủi ro | Giảm thiểu |
| --- | --- |
| Ai có quyền gọi bot cũng đổi được tính cách bot ngay | Có thể xem và xoá trên dashboard; "quên vụ … đi"; dòng `action` ghi ai đã dặn |
| Đổi prompt làm lệch các tool khác (thu chi, công nợ) | Bộ câu mẫu có cả câu thu chi và công nợ; chỉ sửa phần phân loại, giữ nguyên quy tắc gọi tool khác |
| Model sau 9router thay đổi | Script đánh giá chạy lại được bất cứ lúc nào |

## 7. Ngoài phạm vi

Lớp phân loại bằng lượt gọi AI riêng (chỉ cân nhắc nếu bộ đánh giá cho thấy cần), sửa 9router, Cognee và tự học.
