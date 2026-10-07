# Kế hoạch công khai website và chuẩn bị xác minh Google OAuth

RequestFeedback: true

## Mục tiêu

Chuẩn bị zalobot thành một ứng dụng OAuth công khai, có đầy đủ thông tin và trang pháp lý để nộp Google OAuth verification cho các quyền Google Workspace hiện đang yêu cầu.

## Phát hiện hiện tại

- Web hiện tại là Next.js dashboard và chưa có route công khai: toàn bộ page nằm trong nhóm `(private)`.
- Metadata đang dùng URL mặc định `https://zalobot.app`; chưa xác nhận đây là domain thực tế đã sở hữu/có thể triển khai.
- OAuth đang xin nhiều quyền nhạy cảm/restricted: Calendar, Tasks, Gmail modify/send, Drive, Sheets, Docs và Contacts.
- API callback đang dùng `APP_URL + /oauth2callback`; do đó URL public của API cần là HTTPS và phải được khai báo nguyên văn trong Google Cloud Console.
- Worktree đã có các chỉnh sửa chưa liên quan; sẽ giữ nguyên và không ghi đè.

## Phạm vi triển khai đề xuất

1. Thêm các trang public trên web:
   - Landing page mô tả zalobot, các tính năng thực tế, liên hệ hỗ trợ.
   - Privacy Policy tiếng Việt: dữ liệu Google nào được truy cập, mục đích từng nhóm dữ liệu, lưu trữ/mã hóa token, thời hạn lưu, quyền xoá dữ liệu và kênh liên hệ.
   - Terms of Service tiếng Việt.
   - Trang Google API Limited Use / hướng dẫn xóa dữ liệu, nếu cần tách riêng để URL dễ khai báo khi xác minh.
2. Cập nhật metadata, liên kết footer, sitemap/robots để các trang có thể truy cập công khai và Google review được.
3. Rà soát lại `GOOGLE_SCOPES` theo đúng tính năng đã có. Mặc định sẽ giảm các scope chưa được triển khai (Gmail, Drive, Sheets, Docs, Contacts) để giảm phạm vi xét duyệt; giữ Calendar và Google Tasks nếu đó là tính năng đang vận hành.
4. Cập nhật tài liệu vận hành/knowledge của dự án và tạo checklist nộp hồ sơ Google Cloud:
   - cấu hình OAuth consent screen;
   - xác minh domain;
   - thêm authorized redirect URI;
   - bật API tương ứng;
   - nội dung justification và kịch bản quay video demo.
5. Xác thực bằng build, typecheck/lint phù hợp; sau đó triển khai web/API public theo hạ tầng hiện có nếu đã có cấu hình/deployment credentials. Nếu chưa có, bàn giao URL preview và checklist cấu hình production, không tự ý tạo hay mua dịch vụ ngoài.

## Rủi ro và quyết định cần xác nhận

- Đây là thay đổi mức cao vì công khai ứng dụng và tác động xác thực OAuth.
- Gmail/Drive/Docs/Sheets/Contacts có thể làm quy trình review nghiêm ngặt hơn đáng kể; không nên xin trước cho “tính năng có thể làm sau”.
- Cần xác nhận domain production chính thức và email hỗ trợ/công khai để đặt trong Privacy Policy. Hiện có dấu hiệu `zalobot.app`, nhưng chưa thể coi là đã được sở hữu hoặc cấu hình.
- Việc bấm Submit for verification, xác minh quyền sở hữu domain, và cấp quyền triển khai là thao tác trên tài khoản Google/hosting; chỉ thực hiện khi có quyền truy cập và sự đồng ý rõ ràng của chủ tài khoản.

## Kết quả bàn giao

- Bộ trang public sẵn sàng cho Google review.
- Danh sách scope tối thiểu khớp với tính năng thật.
- Hướng dẫn nộp verification với nội dung có thể copy/paste và danh sách bằng chứng/video cần chuẩn bị.
- Website public sau khi môi trường hosting/domain được xác nhận.

## Cần bạn duyệt

Vui lòng xác nhận kế hoạch này và cho biết domain production muốn dùng (ví dụ `zalobot.app`) cùng email hỗ trợ hiển thị công khai. Sau đó mình sẽ bắt đầu triển khai.

## Kết quả triển khai (24/08/2026)

- Đã dùng domain production đã ghi nhận của dự án: `https://zalobot.datintech.site` và email hỗ trợ `datdoan.dev@gmail.com`.
- Đã tạo các trang public `/about`, `/privacy`, `/terms`, cùng `robots.txt` và `sitemap.xml`.
- Đã giới hạn scope OAuth còn profile/email, Calendar và Google Tasks; các scope chưa có tính năng phát hành đã bị loại bỏ.
- Đã đồng bộ README, hướng dẫn vận hành và canonical knowledge.
- Đạt: web build, web typecheck, web lint, API typecheck, API test (49 tests), và `git diff --check`.
- Chưa tự deploy: worktree đã có thay đổi người dùng chưa liên quan từ trước trong các file liên quan đến deploy/tài liệu; không thể commit/push an toàn mà không đưa các thay đổi đó lên production. Khi worktree được tách sạch hoặc các thay đổi đó được người sở hữu xử lý, commit riêng phần này để Coolify tự deploy.
