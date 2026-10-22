---
metadata:
  agent-artifact:
    id: docs-global
    type: documentation
    depends_on:
      - .agents/knowledge/global/README.md
      - .agents/knowledge/global/type-safety.md
      - .agents/knowledge/global/route-constants.md
      - .agents/knowledge/global/monorepo-architecture.md
      - .agents/knowledge/global/dashboard-session.md
      - .agents/knowledge/global/pwa.md
      - .agents/knowledge/global/google-tasks.md
      - .agents/knowledge/global/zalo-command-intake.md
      - .agents/knowledge/global/zalo-response-layout.md
      - .agents/knowledge/global/receipt-image-analysis.md
      - .agents/knowledge/global/local-first-ai-usage.md
      - .agents/knowledge/global/backend-crud-api.md
      - .agents/knowledge/global/backend-exception-filter.md
      - .agents/knowledge/global/i18n.md
      - .agents/knowledge/global/environment-guard.md
      - .agents/knowledge/global/google-oauth-public-verification.md
      - .agents/knowledge/global/web-ui-direction.md
      - .agents/knowledge/global/presentation-boundaries.md
      - .agents/knowledge/global/finance-domain.md
      - .agents/knowledge/global/financial-report-contracts.md
      - .agents/knowledge/global/llm-providers.md
      - .agents/knowledge/global/backend-runtime-services.md
---

# Global Developer Guides

This directory contains human-facing operational guides for system-wide architecture, setup, and global guidelines mirroring [`.agents/knowledge/global/`](../../knowledge/global/README.md).

## Danh Mục Hướng Dẫn Toàn Cục

- [Kiến Trúc Monorepo](monorepo-architecture.md): Cấu trúc npm workspaces, lệnh chạy và phạm vi biến môi trường.
- [Env Guard](environment-guard.md): Hợp đồng cấu hình fail-fast cho API và dashboard.
- [Quy Chuẩn Type Safety & Zero-Any](type-safety.md): Hướng dẫn chi tiết về chính sách cấm `any`, mẫu code thay thế chuẩn và cơ chế hook kiểm tra tự động (Ánh xạ: [`type-safety.md`](../../knowledge/global/type-safety.md)).
- [Quy Chuẩn Quản Lý Route & API Constants](route-constants.md): Hướng dẫn định nghĩa và sử dụng `APP_ROUTES` và `API_ROUTES` tập trung, cấm tuyệt đối hardcode đường dẫn (Ánh xạ: [`route-constants.md`](../../knowledge/global/route-constants.md)).
- [Xử lý cục bộ trước AI](local-first-ai-usage.md): Quy tắc tiết kiệm token và giảm dữ liệu gửi tới AI.
- [Phiên Dashboard và các trang web](dashboard-session.md): One-time exchange token, mã đăng nhập cho app đã cài, thời hạn phiên, phân quyền danh bạ và kiểm tra UI.
- [Ứng dụng cài được (PWA)](pwa.md): Manifest, service worker và quy tắc cache, cập nhật phiên bản, trang offline, nơi mời cài app và header cache của nginx.
- [Việc cần làm qua chat](google-tasks.md): Tool `CREATE_TASK`, cảnh báo task có khả năng trùng và lệnh `/task`/`/tasks`.
- [Công khai web và xác minh Google OAuth](google-oauth-public-verification.md): Scope tối thiểu, trang pháp lý public và checklist nộp Google.
- [Bố cục phản hồi Zalo](zalo-response-layout.md): Response gọn, mã xác nhận 3 số, thả cảm xúc và thu hồi tin nhắn.
- [Nhận lệnh Zalo](zalo-command-intake.md): Webhook + ZCA, guard, cooldown và bảng lệnh fast-path.
- [Phân tích ảnh hoá đơn và thu-chi](receipt-image-analysis.md): Đọc ảnh trong bộ nhớ, đề xuất giao dịch và bắt buộc xác nhận.
- [Định hướng UI web](web-ui-direction.md): Quy chuẩn giao diện dashboard dùng chung, bảng dữ liệu và khả năng truy cập.
- [REST CRUD Backend](backend-crud-api.md): API nghiệp vụ có kiểm tra ownership, admin và tích hợp Google.
- [Global Exception Filter Backend](backend-exception-filter.md): Bộ lọc ngoại lệ toàn cục chuẩn hóa response lỗi và phân loại lỗi TypeORM / HttpException (Ánh xạ: [`backend-exception-filter.md`](../../knowledge/global/backend-exception-filter.md)).
- [Nghiệp vụ thu chi backend](finance-domain.md): Nơi chốn, công nợ, thanh toán nợ, phân bổ giao dịch, danh mục, analytics và tool LLM.
- [Hợp đồng báo cáo tài chính](financial-report-contracts.md): Dữ liệu báo cáo/analytics mà dashboard sử dụng.
- [Nhà cung cấp LLM](llm-providers.md): `LlmService`, chọn provider qua `LLM_PROVIDER` và danh sách tool Zalo.
- [Dịch vụ runtime backend](backend-runtime-services.md): Health/deploy notify, Redis, OCR, lưu media Drive/Photos, scheduler nhắc việc, audit.
- [Đa Ngôn Ngữ](i18n.md): Chuẩn locale dùng chung, cách lưu ngôn ngữ người dùng và cookie dashboard (Ánh xạ: [`i18n.md`](../../knowledge/global/i18n.md)).

## Checklist áp dụng Base Agents cho dự án mới

Base Agents là framework dùng chung, không phải mẫu ứng dụng. Dự án sử dụng nó vẫn tự sở hữu nghiệp vụ, kiến trúc ứng dụng, module, dữ liệu và quy trình kiểm thử riêng.

1. Cài đặt Base Agents, sau đó chỉ kích hoạt plugin thật sự phù hợp với stack và nhu cầu dự án.
2. Điền thông tin thực tế vào `project-overview`: mục tiêu, người dùng, thuật ngữ domain, tích hợp và ranh giới kiến trúc.
3. Với mỗi feature module do dự án tạo, tạo cặp tài liệu tương ứng: knowledge tiếng Anh cho agent và hướng dẫn tiếng Việt cho đội phát triển.
4. Giao việc đúng workflow: `research` cho khảo sát, `investigate` cho chẩn đoán, và `implement` cho thay đổi đã được duyệt.
5. Sau khi thay đổi Base Agents, chạy `npm run agent-system:validate`, `npm run agent-system:test` và `npm run agent-system:typecheck`. Với thay đổi ứng dụng, chạy thêm các kiểm tra riêng của dự án.
