# Walkthrough: Không in token Zalo Bot ra log

Thực hiện theo [implementation_plan.md](implementation_plan.md). Anh duyệt và chọn giữ nguyên việc log nội dung tin.

## Đã làm

- `apps/api/src/zalo/zalo.service.ts` (`sendSingleMessage`): log `{ entrypoint, targetChatId, text }` được thay bằng `Sending Zalo message to <chatId>: "<text>"`. URL có token không còn được log.
- `apps/api/scripts/zalo-webhook.ts`: không in nguyên văn `ZALO_WEBHOOK_SECRET_TOKEN` nữa, chỉ in độ dài.
- `apps/api/src/zalo/zalo.service.spec.ts`: thêm test thu log qua `Logger.overrideLogger`. Test kiểm tra log có chat ID nhưng không chứa token.

## Kiểm tra

- Test mới **fail** khi chạy với `zalo.service.ts` cũ (đã tạm stash bản sửa để thử) và **pass** với bản sửa.
- `npm run typecheck --workspace @zalobot/api`: pass.
- `npm run test --workspace @zalobot/api`: 449/449 pass.
- `eslint` trên 3 file đã sửa: sạch.
- `node .claude/hooks/docs-drift-check.mjs`: pass. Hành vi nghiệp vụ không đổi nên không cập nhật knowledge/docs.

## Còn lại (anh tự làm)

- Đổi token bot trên Zalo Bot Platform rồi cập nhật `ZALO_BOT_TOKEN` trên Coolify và `.env`. Token cũ vẫn còn trong log Coolify trước đây và trong tin nhắn đã dán.
