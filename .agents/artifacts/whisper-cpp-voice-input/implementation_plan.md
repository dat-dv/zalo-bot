---
RequestFeedback: true
route: implement
authority: inspect-and-plan
risk: medium
status: implemented
---

# Kế hoạch tích hợp voice-to-text bằng whisper.cpp

## Mục tiêu

Bot zalo nhận voice note OGG/Opus, phiên âm cục bộ bằng `whisper.cpp` (không API key), hiển thị nội dung dưới dạng `🎙️ Bạn yêu cầu: “…”`, rồi chỉ gửi văn bản đó sang Gemini sau khi người dùng bấm **Xác nhận**.

## Quyết định đã chốt

- Engine: `whisper.cpp` chạy nội bộ trong container, không gọi API bên thứ ba.
- Model mặc định: `base` đa ngôn ngữ, có hỗ trợ tiếng Việt; không dùng biến thể `base.en`.
- Tối ưu độ trễ: khởi động `whisper-server` một lần trong container và gọi HTTP loopback, không khởi động CLI cho từng voice note.
- Âm thanh zalo: giới hạn thời lượng và kích thước; chuyển OGG/Opus thành WAV 16 kHz mono bằng FFmpeg trước khi phiên âm.
- An toàn: transcript phải được xác nhận trước khi vào agent. Các tool làm thay đổi dữ liệu vẫn giữ nguyên lượt xác nhận payload hiện có.

## Phạm vi thay đổi

1. **Runtime và đóng gói**
   - Cập nhật `apps/api/Dockerfile` để cài FFmpeg, build/cài `whisper.cpp`, tải model `base`, và khởi chạy `whisper-server` cùng API bằng một entrypoint giám sát hai tiến trình.
   - Cập nhật `docker-compose.yml` để khai báo volume lưu model/tệp tạm khi cần và bảo đảm chỉ API trong container gọi được service Whisper nội bộ.
   - Không thêm API key, không mở thêm port công khai.

2. **Voice transcription service**
   - Thêm service NestJS trong khu vực `zalo` hoặc module `voice` riêng để: tải file theo `file_id`, kiểm tra giới hạn, chuyển đổi audio, gửi tới `whisper-server`, chuẩn hóa transcript và xóa file tạm trong mọi nhánh thành công/lỗi.
   - Dùng timeout, hàng đợi/giới hạn đồng thời nhỏ và thông báo lỗi thân thiện nếu Whisper không sẵn sàng hoặc âm thanh không hiểu được.
   - Không ghi transcript nguyên văn vào log.

3. **zalo interaction**
   - Thêm handler `@On('voice')` cạnh handler text tại `apps/api/src/zalo/zalo.update.ts`.
   - Trong lúc xử lý, gửi trạng thái zalo phù hợp; sau đó trả card HTML an toàn với transcript và ba nút: **Xác nhận**, **Sửa**, **Hủy**.
   - Lưu một pending voice request theo user, thời hạn 10 phút. Xác nhận sẽ gọi cùng luồng `GeminiService.chat(transcript, …)` mà text đang dùng; hủy xóa request; sửa yêu cầu người dùng gửi lại câu lệnh text.
   - Khi Gemini yêu cầu một thao tác ghi, tái sử dụng confirmation payload hiện có. Như vậy voice không thể trực tiếp kích hoạt tool.

4. **Cấu hình, tài liệu và kiểm thử**
   - Bổ sung biến cấu hình không nhạy cảm cho Whisper (URL nội bộ, model, giới hạn voice, timeout) vào cấu hình và `.env.example`.
   - Cập nhật kiến thức `.agents/knowledge/global/` bằng tiếng Anh; cập nhật hướng dẫn `.agents/docs/global/` và mục lục `.agents/docs/README.md` bằng tiếng Việt; cập nhật tài liệu vận hành Docker/zalo hiện có khi cần.
   - Thêm unit test cho kiểm tra giới hạn, xử lý lỗi và trạng thái pending voice; kiểm thử handler xác nhận bằng mock zalo/Gemini/Whisper.

## Luồng sau triển khai

```text
zalo voice OGG/Opus
  → kiểm tra giới hạn → FFmpeg WAV 16 kHz mono
  → whisper-server nội bộ (model base)
  → “Bạn yêu cầu: <transcript>”
  → [Xác nhận] → GeminiService.chat
  → [Xác nhận payload hiện có nếu tool ghi dữ liệu]
```

## Kiểm thử và tiêu chí hoàn thành

- Voice tiếng Việt ngắn tạo được transcript và không gọi Gemini trước khi người dùng xác nhận.
- Hủy, hết hạn, voice quá dài/lớn, download thất bại, chuyển đổi thất bại và Whisper lỗi đều phản hồi an toàn, không để file tạm.
- Một transcript tạo lịch/task vẫn đi qua confirmation payload hiện có trước khi ghi dữ liệu.
- `npm run typecheck`, `npm run lint`, build Docker và smoke test voice trong zalo đều đạt.

## Rủi ro và lưu ý

- Máy yếu có thể xử lý chậm với `base`; giữ giới hạn voice và hàng đợi nhỏ để text commands không bị nghẽn.
- Build image tăng kích thước do model và FFmpeg; model cần được cache bằng volume hoặc image layer.
- Lệnh `npm run agent-system:validate` không tồn tại trong repository hiện tại; quy trình xác minh sẽ dùng các quality gate có sẵn và báo riêng tình trạng này.

## Kết quả triển khai

- Đã thêm `VoiceTranscriptionService`, handler zalo `voice`, pending transcript theo người dùng và các callback Xác nhận/Sửa/Hủy.
- Đã đóng gói `whisper.cpp` model `base` cùng FFmpeg trong Docker image; whisper-server chỉ lắng nghe tại `127.0.0.1:8080`.
- Đã cập nhật cấu hình mẫu và tài liệu knowledge/docs cho luồng voice.
- Xác minh đạt: API typecheck, API build, Prettier check và `git diff --check`.
- Chưa thể build Docker trong môi trường này vì Docker daemon không chạy (`docker.sock` không tồn tại). Cần chạy `docker compose build api` trên máy có Docker daemon để kiểm tra image thực tế.
