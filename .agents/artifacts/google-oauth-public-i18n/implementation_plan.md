# Kế hoạch sửa i18n cho các trang OAuth public

RequestFeedback: true

## Nguyên nhân

Pre-commit chặn commit với 57 lỗi vì `apps/web/app/about/page.tsx`, `privacy/page.tsx` và `terms/page.tsx` có chuỗi hiển thị trực tiếp trong JSX. Dự án yêu cầu toàn bộ chuỗi đó sử dụng `t('key')` từ catalog `@zalobot/contracts`; các liên kết route cũng phải dùng `APP_ROUTES`.

## Thay đổi dự kiến

1. Bổ sung nhóm translation key song ngữ Việt/Anh cho nội dung giới thiệu, chính sách quyền riêng tư và điều khoản vào `packages/contracts/src/index.ts`.
2. Chuyển ba page thành client components hoặc tách component client để gọi `useLocale().t`, vẫn giữ metadata ở server page nếu cần.
3. Bổ sung các route public (`about`, `privacy`, `terms`) vào `APP_ROUTES` và thay các `href` hard-code bằng constants.
4. Chuyển các chuỗi động như năm hiện tại và email hỗ trợ sang interpolation values qua `t(key, values)`.
5. Cập nhật cặp tài liệu knowledge/docs i18n và route constants, chạy `agent-system:validate -- --check-changes --check-i18n`, build, typecheck và lint web.

## Phạm vi và rủi ro

Thay đổi giới hạn ở catalog i18n, constants và ba page public; không đổi dữ liệu, OAuth flow hay hạ tầng. Sẽ không chạm các thay đổi đang staged khác của bạn.

## Cần bạn duyệt

Xác nhận kế hoạch này để mình sửa trực tiếp và chạy lại kiểm tra commit.
