# Kế hoạch: tối ưu thời gian Docker build khi deploy Coolify

RequestFeedback: true

## Mục tiêu

Giảm đáng kể thời gian deploy lặp lại của API mà không thay đổi chức năng zalo bot, OCR, Whisper, hay phạm vi biến môi trường. Giữ nguyên cách Coolify truyền secrets khi chạy container; tuyệt đối không đưa secrets vào image hoặc frontend bundle.

## Phát hiện đã xác nhận

- Build web là cache-hit hoàn toàn trong log; API cache miss ở `npm ci`.
- API cold-build đồng thời cài toolchain/FFmpeg, biên dịch `whisper.cpp`, và tải model `ggml-base.bin`.
- Docker context chỉ ~800 KB, nên `.dockerignore` không phải nguyên nhân chính, nhưng vẫn có thể làm chặt để cache ổn định hơn.
- Lớp Whisper hiện tách riêng khỏi source app; nó chỉ nhanh khi cache BuildKit trên host Coolify còn tồn tại.

## Phạm vi thay đổi

1. `apps/api/Dockerfile`
   - Khai báo Dockerfile syntax BuildKit và thêm cache mount có ID ổn định cho npm, APK và (nếu phù hợp) build C/C++ của Whisper.
   - Giữ dependency manifests ở trước source code để sửa TypeScript không làm mất cache `npm ci`.
   - Pin revision của `whisper.cpp` thay vì clone mặc định `HEAD`, tạo cache determinism và tránh bản upstream đổi bất ngờ làm build/behaviour thay đổi.
   - Tách rõ cache cho Whisper/model, vẫn giữ một image API duy nhất và startup contract hiện hữu (`whisper-server` loopback).
   - Không dùng `ARG`/`ENV` cho secrets, không thay đổi `NEXT_PUBLIC_API_URL` hay biến runtime API.
1. `apps/web/Dockerfile`
   - Bổ sung npm cache mount tương ứng để web vẫn nhanh cả khi layer dependency bị mất nhưng cache BuildKit còn.
1. `.dockerignore`
   - Loại trừ artefact, tài liệu, test output và file local không cần thiết khỏi Docker context, đồng thời giữ lại mọi file cần cho build monorepo.
1. Tài liệu vận hành
   - Cập nhật `.agents/knowledge/global/monorepo-architecture.md` (English) và `.agents/docs/global/monorepo-architecture.md` (Vietnamese) về cache behavior, cold build và cách xác minh trên Coolify.
   - Cập nhật walkthrough trong thư mục artifact sau khi đã kiểm chứng.

## Những gì kế hoạch này không giải quyết triệt để

Nếu Coolify xóa toàn bộ BuildKit cache, chuyển sang host mới, hoặc base image mới xuất hiện, deploy sẽ vẫn có một cold build. Việc biến Whisper thành image build sẵn trên registry sẽ giảm cold-build mạnh hơn nữa, nhưng cần một registry/pipeline phát hành image riêng — đó là phạm vi mở rộng, không tự thực hiện trong đợt này.

## Kiểm chứng sau khi sửa

1. Kiểm tra Dockerfile parse/build target và bảo đảm không có secret trong history/build arguments được dùng bởi layer.
2. Build API và web hai lần với BuildKit; lần thứ hai phải thể hiện cache hit cho npm và Whisper khi không đổi dependency/Dockerfile.
3. Chạy `npm run build`, `npm run lint`, `npm run typecheck` theo mức phù hợp; báo riêng mọi lỗi có sẵn không do thay đổi này.
4. Kiểm tra diff để bảo toàn các thay đổi UI chưa commit của bạn.

## Rủi ro và rollback

- Rủi ro trung bình: thay đổi cache/build pipeline, không đổi business logic.
- Pin Whisper có thể khiến bản binary không còn tự đổi theo upstream; đây là chủ đích để build lặp lại ổn định.
- Rollback đơn giản: hoàn nguyên 3 file cấu hình Docker và 2 tài liệu; không có migration hay thay đổi dữ liệu.
