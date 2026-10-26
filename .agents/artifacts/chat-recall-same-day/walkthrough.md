# Walkthrough: Cognee nạp theo đợt, /sync, không che, tìm từ khoá bền hơn

Thực hiện theo [implementation_plan.md](implementation_plan.md), anh Đạt duyệt ngày 26/10/2026 (gồm cả Phần 2).

## Đã làm
1. **Không che dữ liệu**: `buildChatDayDocument` gửi nguyên văn; xoá `maskLongNumbers` và test của nó.
2. **Nạp theo đoạn**:
   - Bảng `zca_memory_segments`, migration `1724990000000-AddChatMemorySegments`, entity đã đăng ký ở `database.module`, `data-source` và `ZcaModule`. Bảng này nằm ngoài nhật ký kiểm toán.
   - `MemorySegmentScheduler`: hẹn giờ 3 phút, trần 15 phút, chạy job `segment` trên queue `chat-memory`, gửi bù sau khi khởi động.
   - `MemoryIngestService`: `ingestSegment`, `runSegment` (có `resetToday` khi thu hồi tin hôm nay), `runSync`, `forgetSegments` (job đêm xoá các đoạn trước khi nạp cả ngày), và `status.todayIngestedUntil`.
   - `ChatMemoryService.dayLines` nhận thêm mốc `after`; `markRecalled` trả về thời điểm gửi của tin bị thu hồi.
   - **Khác plan**: plan ghi "dời job trễ BullMQ", còn bản làm dùng timer trong tiến trình và gửi bù sau khi khởi động. Kết quả như plan (khởi động lại không mất tin) mà không phụ thuộc cách chống trùng (dedup/debounce) của BullMQ, thứ chưa kiểm chứng được.
3. **`/sync`**: `TextToolType.SYNC_MEMORY`, `SyncMemoryToolStrategy`, nhận qua fast-path, thêm vào `/help`. Processor gửi `syncResultText` vào chat khi xong.
4. **Dashboard**:
   - Contract `IChannelMemoryStatus.todayIngestedUntil`; dòng trạng thái thêm "Hôm nay đã nạp tới HH:mm".
   - Câu chữ thẻ Nhớ lâu dài: thêm mục "Khi nào nạp" và cảnh báo tin được gửi nguyên văn.
5. **Tìm theo từ khoá** (`searchTerms`, `buildHitQuery`):
   - Tách chữ của cụm nhiều chữ, nối bằng OR, bỏ từ dừng.
   - Tìm thêm theo chuỗi (`ILIKE`) cho tên miền, email, link, và xếp các tin này lên đầu.
   - Mô tả `keywords` nhắc AI thêm từ viết tắt.
6. **Phân loại ý định**: thêm `CHAT_HISTORY_INTENT_RULE` (chỉ khi bật Nhớ lâu dài) và 4 ca vào intent eval.
7. **Tài liệu**: knowledge và docs `modules/zca/chat-memory.md`, `global/local-first-ai-usage.md`, `global/zalo-command-intake.md`, `CONTEXT.md`.

## Kiểm tra
- `npm run typecheck`, `npm run lint`: pass.
- api 815/815 test pass; web 141/141 test pass; `npm run build --workspace @zalobot/web`: pass.
- Truy vấn tìm kiếm mới chạy thử trên Postgres local (bảng tạm, bỏ `zalobot_unaccent`): tìm ra cả `c.datintech.site`, `admin`, `mk : …`, bỏ qua tin không liên quan, tên miền đứng đầu.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.
- **Chưa chạy**:
  - Cognee thật (nạp đoạn, `forget` khi nạp đêm).
  - `npm run eval:intent` với LLM thật cho các ca mới.
  - Kiểm tra bằng mắt trang `/zca/thread`.
- Migration tự chạy khi API khởi động (`migrationsRun: true`).
