---
RequestFeedback: true
---

# Kế hoạch sửa đăng ký artifact cho tài liệu zalo

## Mục tiêu

Cho phép pre-commit vượt qua `npm run agent-system:validate` bằng cách đăng ký đầy đủ hai hướng dẫn zalo và tạo liên kết trực tiếp đến canonical knowledge tương ứng.

## Phạm vi thay đổi

| Tệp                                           | Thay đổi                                                                                                                                                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/docs/global/zalo-command-intake.md`  | Thêm YAML frontmatter `agent-artifact` với ID duy nhất, kiểu `documentation`, và `depends_on` trỏ tới `.agents/knowledge/global/zalo-command-intake.md`. Thêm liên kết Markdown trực tiếp đến canonical knowledge để nhất quán với các hướng dẫn hiện có. |
| `.agents/docs/global/zalo-response-layout.md` | Thêm YAML frontmatter `agent-artifact` với ID duy nhất, kiểu `documentation`, và `depends_on` trỏ tới `.agents/knowledge/global/zalo-response-layout.md`. Thêm liên kết Markdown trực tiếp đến canonical knowledge.                                       |
| `.agents/docs/global/README.md`               | Bổ sung hai tệp knowledge zalo vào `metadata.agent-artifact.depends_on` của chỉ mục global để phản ánh đầy đủ các cặp tài liệu.                                                                                                                           |

## Không thay đổi

- Không sửa mã ứng dụng, hành vi bot, hoặc nội dung nghiệp vụ của các tài liệu.
- Không thay đổi các tệp artifact/tài liệu không liên quan đang có trong worktree.

## Kiểm chứng

1. Chạy `npm run agent-system:validate`; kỳ vọng không còn bốn lỗi về zalo documentation coverage/registered artifact.
2. Chạy `git diff --check` cho các tệp đã sửa để phát hiện lỗi whitespace.
3. Xem lại diff, bảo đảm chỉ gồm metadata và liên kết tài liệu thuộc phạm vi nêu trên.

## Rủi ro và hoàn tác

Rủi ro thấp: chỉ thay đổi metadata và liên kết nội bộ. Có thể hoàn tác độc lập bằng cách gỡ frontmatter/liên kết đã thêm.
