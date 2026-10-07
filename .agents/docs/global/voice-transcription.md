---
metadata:
  agent-artifact:
    id: docs-global-voice-transcription
    type: documentation
    depends_on:
      - .agents/knowledge/global/voice-transcription.md
---

# Nhận diện voice cục bộ

Tài liệu này hướng dẫn cơ chế nhận diện giọng nói cục bộ qua Whisper và luồng xử lý âm thanh trong zalo Bot, ánh xạ trực tiếp với tri thức canonical [`voice-transcription.md`](../../knowledge/global/voice-transcription.md).

## Mục đích

Bot nhận zalo voice, phiên âm bằng `whisper.cpp` chạy ngay trong container và yêu cầu người dùng duyệt transcript trước khi gửi sang Gemini. Không cần API key cho phần voice-to-text.

## Cấu hình

| Biến                         | Mặc định                | Ý nghĩa                                       |
| ---------------------------- | ----------------------- | --------------------------------------------- |
| `WHISPER_URL`                | `http://127.0.0.1:8080` | Địa chỉ Whisper nội bộ. Không mở ra Internet. |
| `WHISPER_TIMEOUT_MS`         | `45000`                 | Thời gian tối đa chờ phiên âm.                |
| `VOICE_MAX_DURATION_SECONDS` | `90`                    | Độ dài voice tối đa.                          |
| `VOICE_MAX_BYTES`            | `8388608`               | Dung lượng voice tối đa.                      |
| `WHISPER_THREADS`            | `2`                     | Số luồng CPU cho Whisper trong container.     |

Docker image tự build `whisper.cpp`, tải model đa ngôn ngữ `base`, cài FFmpeg và khởi động Whisper ở loopback khi API khởi động.

## Luồng sử dụng

1. Người dùng gửi voice zalo.
2. Bot phản hồi thẻ **BẠN YÊU CẦU** kèm transcript.
3. **Xác nhận** mới gửi transcript sang Gemini; **Sửa bằng text** hoặc **Hủy** xóa yêu cầu chờ.
4. Nếu Gemini chuẩn bị tạo/sửa dữ liệu, nút xác nhận payload hiện có vẫn xuất hiện thêm một lần.

## Khắc phục sự cố

- Thông báo Whisper chưa sẵn sàng: kiểm tra log container, bảo đảm tiến trình `whisper-server` chạy và `WHISPER_URL` giữ địa chỉ loopback.
- Voice quá dài/lớn: giảm thời lượng hoặc điều chỉnh giới hạn theo CPU/RAM máy chủ.
- Phiên âm chậm: tăng `WHISPER_THREADS` khi máy còn CPU; không tăng quá số core cấp cho container.
- Transcript sai: dùng nút **Sửa bằng text**; model `base` ưu tiên tốc độ, có thể chuyển sang `small` khi chấp nhận RAM cao hơn.
