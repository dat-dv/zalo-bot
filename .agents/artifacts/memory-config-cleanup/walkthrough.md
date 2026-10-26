# Walkthrough: Gọn cấu hình Trí nhớ của kênh

Thực hiện theo [implementation_plan.md](implementation_plan.md), được anh duyệt ngày 26/10/2026. API ghi nhớ ở backend được giữ lại theo đề xuất trong plan.

## Đã làm

1. **Bỏ UI Ghi nhớ**
   - Xoá `channel-notes-section.tsx`.
   - Xoá các hàm API và hook ghi nhớ ở FE, cùng `noteTextError`.
   - Bot vẫn nhớ và quên qua chat như cũ.
2. **Xoá trí nhớ ngắn hạn**
   - contracts: `ThreadChatMemoryConfig` chỉ còn `enabled`, `readImageText`, `learnPeople`. Normalizer bỏ các key cũ.
   - api:
     - Xoá `ShortTermMemoryService`, `ChatMemoryService.getRecent`, `SHORT_TERM_KINDS`, `formatRecentContextBlock` và block "NGỮ CẢNH GẦN ĐÂY" trong prompt.
     - Xoá cơ chế lưu tạm (`MemoryRetention`, `shortTermExpiry`).
     - Lưu tin, ghi thao tác đã duyệt và đọc chữ ảnh chỉ còn chạy khi bật nhớ lâu dài.
     - Dòng cũ có `expires_at` vẫn được job đêm xoá.
   - web:
     - Xoá `short-term-memory-section.tsx`, `ChatMemoryDraft` và nhãn "Ngữ cảnh".
     - Gợi ý trong mục ảnh đổi thành "bật Nhớ lâu dài".
3. **Agent tự chọn số kết quả tra**
   - Tool `SEARCH_CHAT_HISTORY` có thêm tham số `limit`. `readSearchLimit` giới hạn 1–50, mặc định 15.
   - Prompt hướng dẫn agent khi nào lấy nhiều, khi nào lấy ít.
   - Bỏ mục "Nâng cao" trên UI.
4. **Tài liệu**: knowledge (EN), docs (VI), `CONTEXT.md`.

## Kiểm tra
- `npm run typecheck`: pass (api, web, contracts).
- `npm run lint`: pass, sau khi chạy prettier cho các file đã sửa.
- api: 795/795 test pass. web: 141/141 test pass.
- `npm run build --workspace @zalobot/web`: pass.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.
- Chưa kiểm tra bằng mắt trang `/zca/thread` trên trình duyệt.
- Chưa chạy `npm run eval:intent` với LLM thật cho tham số `limit` mới.
