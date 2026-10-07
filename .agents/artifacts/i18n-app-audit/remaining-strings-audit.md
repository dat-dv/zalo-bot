# Audit chuỗi i18n còn lại

## Kết luận

Đợt triển khai trước mới hoàn thành nền locale, selector dashboard, locale persistence zalo và reminder scheduler. Chưa đạt i18n toàn app.

## Số liệu source hiện tại

| Khu vực                  | Chuỗi tiếng Việt còn lại | Tệp bị ảnh hưởng | Trạng thái                                                              |
| ------------------------ | -----------------------: | ---------------: | ----------------------------------------------------------------------- |
| `apps/web/app`           |                   1 dòng |                1 | Metadata chưa locale-aware                                              |
| `apps/web/src`           |                 108 dòng |                4 | Dashboard/contacts/debts/expenses vẫn hard-code UI và formatter `vi-VN` |
| `apps/api/src`           |                 613 dòng |               48 | zalo, Gemini tools, Google/OAuth, domain error và test fixture          |
| `packages/contracts/src` |                  13 dòng |                1 | Catalog hiện mới chứa một phần nhỏ key                                  |

## Phân loại ưu tiên

### P0 — trực tiếp hiển thị cho user

1. `apps/web/src/modules/**/view/*.tsx`: headings, labels, table headers, states loading/error/empty, action labels, `aria-label`, và tất cả formatter tiền/ngày.
2. `apps/api/src/zalo/zalo.update.ts`: welcome/help/status/dashboard/admin flows, callback responses, OCR follow-up.
3. `apps/api/src/zalo/services/zalo-ui.service.ts`: toàn bộ inline keyboards, confirmation/result box, notification controls.
4. `apps/api/src/reminders/reminder-scheduler.service.ts`: body reminder vẫn là tiếng Việt; mới chỉ dịch header và hai actions.
5. `apps/api/src/google/templates/oauth-html.template.ts` và `reports.controller.ts`: HTML/error page người dùng thấy.

### P1 — Gemini/bot output gián tiếp

- 22 tệp trong `apps/api/src/gemini/tools/`: tool descriptions, validation error, success/error/instruction payload.
- `gemini.service.ts` và `gemini-prompt.helper.ts`: system instruction, OCR prompt, fallback text.
- Google Tasks/Calendar/Auth và finance service: error/message được chuyển tiếp qua bot.

### P2 — không dịch trực tiếp nhưng cần phân định

- Logger, validation ENV, enum/domain comment và test fixture không phải tất cả đều là user-facing. Cần allow-list để linter không báo sai.
- Dữ liệu user nhập và external provider error không được dịch trực tiếp. Chúng phải map về error code/message key trước ranh giới presentation.

## Lỗ hổng kiến trúc cần sửa trước P0/P1

1. `ToolExecutionContext` chưa mang `locale`; Gemini chat, pending confirmation và tool execution chưa truyền locale xuyên suốt.
2. `zaloUiService` chưa nhận `locale` cho các builder; hiện hầu hết keyboard/confirmation vẫn hard-code.
3. Dashboard chỉ đổi navigation/selector, chưa dùng catalog cho từng module screen.
4. Catalog không có test completeness; thêm một key ở `vi` có thể quên `en`.
5. Không có script cấm literal UI mới.

## Validation blocker

`npm run agent-system:validate` đang fail với 2 lỗi:

- `.agents/knowledge/global/i18n.md` thiếu liên kết human-facing được hệ thống nhận diện.
- `.agents/docs/global/i18n.md` chưa được đăng ký là artifact/tài liệu hợp lệ.

Đây là hệ quả của đợt triển khai trước và phải được khắc phục cùng với cập nhật knowledge/docs tiếp theo.

## Đề xuất đợt thực hiện tiếp theo

1. Hoàn thiện adapter và catalog: context locale Gemini/tool/UI, keys cho P0/P1, test parity `vi`/`en`.
2. Chuyển 4 web screen và metadata/formatter; test desktop/mobile ở hai locale.
3. Chuyển `zaloUiService`, `zaloUpdate`, reminder body, OAuth/reports HTML.
4. Chuyển 22 Gemini tools và service response theo nhóm domain (calendar/tasks, reminder, finance/debt, user/admin).
5. Thêm lint guard có allow-list, sửa registration tài liệu, chạy validation/build/test.
