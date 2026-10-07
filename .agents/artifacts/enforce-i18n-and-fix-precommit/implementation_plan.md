---
RequestFeedback: true
---

# Kế hoạch: bắt buộc i18n cho text hiển thị và sửa pre-commit

## Chẩn đoán

Pre-commit fail đúng như log: `.agents/docs/global/i18n.md` không có YAML `metadata.agent-artifact`, nên không được registry nhận diện. Vì vậy liên kết trong guide không được tính là human-facing coverage cho `.agents/knowledge/global/i18n.md`.

## Thay đổi dự kiến

1. Sửa cặp tài liệu i18n:
   - Thêm frontmatter `agent-artifact` hợp lệ cho `.agents/docs/global/i18n.md`, có ID riêng và `depends_on` trỏ tới knowledge i18n.
   - Bổ sung liên kết Markdown hai chiều giữa guide và canonical knowledge.
   - Cập nhật metadata `depends_on` của các chỉ mục global nếu validator yêu cầu.
   - Đồng bộ sidecar mapping để artifact graph nhận cả hai tài liệu.
1. Thêm rule `i18n-no-hardcoded-user-text` dưới `.agents/rules/`:
   - Áp dụng luôn cho frontend, zalo, email/notification, HTML template, Gemini output/prompt và API error hiển thị cho người dùng.
   - Bắt buộc dùng key qua adapter i18n; key có mặt ở mọi supported locale; mọi giá trị dynamic chỉ truyền interpolation.
   - Cấm literal user-facing trong JSX, `ctx.reply`, `sendMessage`, `Markup.button`, toast/alert, metadata, template HTML và result/error/instruction của tool.
   - Ngoại lệ tường minh: log kỹ thuật, error nội bộ không render ra user, route/enum/callback/tool name/protocol, test fixture và dữ liệu user/external provider. Ngoại lệ phải được ghi nhận ở guard, không dùng `eslint-disable` ad hoc.
   - Kèm knowledge EN, developer guide VI và system-explain sidecar cho rule mới.
1. Bổ sung chặn tự động trong pre-commit:
   - Viết validator quét **staged TypeScript/TSX và HTML template** với rule ngữ cảnh, chỉ báo literal ở các API/bề mặt user-facing nêu trên.
   - Cho phép literal emoji, callback data và allow-list kỹ thuật đã xác định; lỗi báo file/dòng và key i18n cần dùng.
   - Gắn validator vào `scripts/agent-system/precommit` để commit mới bị chặn trước khi vào nhánh.
   - Thêm regression tests cho: literal trong JSX/zalo bị chặn, `translate(...)` được cho phép, log/callback/test fixture không bị false positive.
1. Xác minh:
   - `npm run agent-system:validate` xanh.
   - Chạy test validator/precommit mới với fixture pass/fail.
   - Chạy `npm run lint`, `npm run typecheck`, `git diff --check`.

## Không thay đổi trong đợt này

- Không chuyển toàn bộ 721 chuỗi còn lại sang catalog; đó là migration riêng đã được audit.
- Không đổi API, data schema hoặc hành vi zalo/dashboard.

## Rủi ro

Guard quá rộng có thể block text kỹ thuật hợp lệ; guard sẽ chỉ xét callsite/bề mặt UI đã định nghĩa và có allow-list có kiểm thử. Rule mới sẽ ngăn chuỗi mới, không tự thay thế các chuỗi legacy.
