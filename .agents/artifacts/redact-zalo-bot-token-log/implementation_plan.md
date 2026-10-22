# Kế hoạch: Không in token Zalo Bot ra log

- Route: implement · Phase 1 (Planning) · Rủi ro: LOW (chỉ sửa dòng log, không đổi API/schema/hành vi gửi tin)
- Phạm vi: `apps/api/src/zalo/zalo.service.ts`, `apps/api/src/zalo/zalo.service.spec.ts`, `apps/api/scripts/zalo-webhook.ts`

## Vấn đề

Mỗi lần gửi tin, [zalo.service.ts:89](../../../apps/api/src/zalo/zalo.service.ts) gọi `this.logger.log({ entrypoint, targetChatId, text })`. `entrypoint` là `https://bot-api.zaloplatforms.com/bot<TOKEN>/sendMessage` (`ZALO_API_URLS.BOT_SEND_MESSAGE`), nên token bot bị ghi nguyên văn vào log production (Coolify). Ai đọc được log đều gửi được tin dưới danh nghĩa bot.

Đã rà các chỗ khác dùng URL có token:

| Chỗ | Có in token? |
| --- | --- |
| `zalo.service.ts:89` (`sendSingleMessage`) | **Có**, mỗi tin gửi đi |
| `zalo.service.ts:271` (`sendChatAction`) | Không, chỉ dùng để `fetch`; log lỗi chỉ in body phản hồi và `err.message` |
| Log lỗi `zalo.service.ts:129`, `:144` | Không: in body phản hồi của Zalo và `err.message` của `fetch` (không chứa URL) |
| `scripts/zalo-webhook.ts:18` (`baseUrl`) | Không in token, nhưng dòng 72 in **nguyên văn `ZALO_WEBHOOK_SECRET_TOKEN`** ra console |
| `scripts/tunnel.sh:276`, `:287` | Không, chỉ dùng trong `curl`, không `echo` |

## Thay đổi

1. **`zalo.service.ts` `sendSingleMessage`**: bỏ `entrypoint` khỏi log, giữ nguyên phần còn lại. Đổi thành chuỗi một dòng giống style log khác trong file:
   `this.logger.log(\`Sending Zalo message to ${targetChatId}: ${JSON.stringify(text)}\`)`.
   Không thêm helper che token: sau thay đổi này không còn chỗ nào log URL có token, thêm helper chỉ là trừu tượng hoá thừa.
2. **`scripts/zalo-webhook.ts:72`**: đổi `🔒 Kèm secret_token: ${secretToken}` thành `🔒 Kèm secret_token (đã ẩn, ${secretToken.length} ký tự)`.
3. **Test** (`zalo.service.spec.ts`): thêm 1 test gửi tin với token giả, gắn `LoggerService` thu log qua `Logger.overrideLogger(...)` (API chuẩn của Nest, không cần ép kiểu), kiểm tra log có `targetChatId` và không chứa token. Cuối test gọi `Logger.overrideLogger(...)` để khôi phục logger mặc định.

## Không làm (ngoài phạm vi, chỉ báo)

- Log vẫn in **nguyên nội dung tin nhắn** bot gửi (có thể có số tiền, tên người). Đó là hành vi có sẵn, em giữ nguyên. Nếu anh muốn chỉ in độ dài tin thì báo, em đổi luôn trong bước 1.
- **Đổi token**: phải làm trên Zalo Bot Platform, rồi cập nhật `ZALO_BOT_TOKEN` trên Coolify và `.env`. Việc này anh tự làm; sửa code không thu hồi được token đã lộ trong log cũ và trong chat.

## Kiểm tra

- `npm run typecheck --workspace @zalobot/api`
- `npx tsx --test src/zalo/zalo.service.spec.ts` (trong `apps/api`), sau đó `npm run test --workspace @zalobot/api`
- `npx eslint` trên 3 file đã sửa (không chạy `npm run lint` vì script có `--fix`, sẽ sửa cả file ngoài phạm vi)
- Docs: không đổi hành vi nghiệp vụ, nên không cần cập nhật `.agents/knowledge` / `.agents/docs`. Vẫn chạy `node .claude/hooks/docs-drift-check.mjs`.
