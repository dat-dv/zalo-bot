# Kế hoạch: Chuyển Theme & Money Visibility provider sang Zustand

- Route: `implement` · Phase 1 (Planning) · Rủi ro: **MEDIUM** (nhiều file, chỉ đổi frontend, không đụng API/DB/auth)
- Active skills: `frontend-orchestration` (rule 07 — Tier 4 Global UI State dùng Zustand ở `src/shared/store/`), `nextjs-static`

## 1. Mục tiêu

Chuyển state giao diện dùng chung toàn app (theme, ẩn/hiện số tiền) từ React Context sang Zustand. Hành vi người dùng thấy **giữ nguyên 100%**. Bỏ 2 lớp provider khỏi `AppProviders`.

### Ngoài phạm vi
- `QueryClientProvider`, `ErrorBoundary`, `ReactScanProvider`, `IosViewportFix`: giữ nguyên.
- `LocaleProvider`: **mặc định không chuyển** (xem mục 6, anh chọn khi duyệt).
- Không đổi UI, i18n key hay cách tô màu dark mode.

## 2. Hiện trạng (đã kiểm tra)

| File | Ghi chú |
|---|---|
| `apps/web/src/shared/providers/app-providers.tsx` | Lồng `LocaleProvider > MoneyVisibilityProvider > ThemeProvider` |
| `apps/web/src/shared/providers/theme-provider.tsx` | `useTheme()` có 1 chỗ dùng: `shared/ui/app-navigation.tsx` |
| `apps/web/src/shared/providers/money-visibility-provider.tsx` | **Đang có thay đổi chưa commit** (task `money-visibility-no-persist`: bỏ localStorage). Plan này làm tiếp trên bản hiện tại, giữ nguyên quy tắc "chỉ lưu trong bộ nhớ". `useMoneyVisibility` dùng ở `workspace-header.tsx`, `useMoneyFormatter` import ở 16 file |
| `apps/web/app/layout.tsx:103` | Script inline đặt `data-theme` trước khi hydrate (không đổi) |
| `apps/web/package.json` | Chưa có `zustand` |

App là static export (SPA, không có server runtime), nên dùng store singleton `create()` ở mức module là an toàn. Không cần pattern bọc store trong Context + `useRef` (pattern đó chỉ dành cho SSR).

## 3. Thiết kế

### 3.1 `apps/web/src/shared/store/theme-store.ts`
```ts
type Theme = 'light' | 'dark';
interface ThemeState { theme: Theme; syncFromDocument: () => void; toggleTheme: () => void; }
export const useThemeStore = create<ThemeState>()((set, get) => ({ ... }));
export function useTheme() { /* useShallow chọn { theme, toggleTheme } — giữ nguyên chữ ký cũ */ }
```
- State ban đầu là `'light'`, để HTML build sẵn và lần render đầu khớp nhau (tránh lệch hydration).
- `syncFromDocument()` đọc `document.documentElement.dataset.theme`, vốn đã được script inline trong `layout.tsx` đặt sẵn (dùng lại `getPreferredTheme()` làm phương án dự phòng). Hàm này được gọi trong `useEffect` của `AppProviders`.
- `toggleTheme()` ghi `localStorage['zalobot-theme']` (bọc try/catch như hiện tại) và đặt `dataset.theme`.

### 3.2 `apps/web/src/shared/store/money-visibility-store.ts`
```ts
interface MoneyVisibilityState { isMoneyVisible: boolean; toggleMoneyVisibility: () => void; setMoneyVisibility: (v: boolean) => void; }
export const useMoneyVisibilityStore = create<MoneyVisibilityState>()((set) => ({ isMoneyVisible: false, ... }));
export function useMoneyVisibility() { /* useShallow: { isMoneyVisible, toggleMoneyVisibility, setMoneyVisibility, money } */ }
export function useMoneyFormatter() { /* selector isMoneyVisible + useLocale() → useCallback money(value) */ }
```
- **Không dùng middleware `persist`.** Giữ comment giải thích: mỗi lần load lại trang, số tiền phải ẩn.
- Hàm `money()` là giá trị suy ra (phụ thuộc trạng thái ẩn/hiện và locale), không lưu trong store.
- Giữ nguyên interface `MoneyVisibilityContextValue` (đổi tên thành `MoneyVisibilityValue`) để kiểu trả về của `useMoneyVisibility()` không đổi.

### 3.3 `app-providers.tsx`
- Bỏ `MoneyVisibilityProvider` và `ThemeProvider` khỏi cây provider.
- Thêm `useThemeStore.getState().syncFromDocument()` vào `useEffect` đang có (cạnh `captureDashboardToken()`).

### 3.4 Cập nhật import (chỉ đổi đường dẫn, không đổi logic)
- `@/shared/providers/theme-provider` → `@/shared/store/theme-store` (1 file).
- `@/shared/providers/money-visibility-provider` → `@/shared/store/money-visibility-store` (16 file).
- Xoá `theme-provider.tsx` và `money-visibility-provider.tsx`. Không để lại file re-export trung gian.

## 4. Các bước thực hiện (Phase 2)

1. `npm install zustand --workspace @zalobot/web` (bản 5.x ổn định).
2. Tạo `src/shared/store/theme-store.ts` và `src/shared/store/money-visibility-store.ts`.
3. Sửa `app-providers.tsx`.
4. Đổi import ở 17 file, xoá 2 file provider cũ.
5. Thêm test thuần `src/shared/store/money-visibility-store.spec.ts` (chạy bằng `tsx --test` như các spec hiện có): mặc định ẩn, toggle, set. Kèm 1 test xác nhận store mới tạo luôn có `isMoneyVisible === false`.
6. Cập nhật tài liệu (mục 5).
7. Kiểm tra: `npm run typecheck`, `lint`, `test`, `build` (tất cả với `--workspace @zalobot/web`), `node .claude/hooks/docs-drift-check.mjs`. Sau đó chạy dev, mở bằng browser để thử toggle theme (giữ sau F5), toggle ẩn/hiện tiền (về ẩn sau F5, vẫn giữ khi chuyển trang trong app) và đổi locale (định dạng tiền đổi theo).

## 5. Cập nhật tài liệu (Hard Completion Gate)

- `.agents/knowledge/global/web-ui-direction.md`: đổi `MoneyVisibilityProvider` thành `useMoneyVisibilityStore` (Zustand, chỉ lưu trong bộ nhớ, không `persist`); cập nhật `depends_on`; bổ sung quy tắc: state giao diện dùng chung toàn app đặt ở `apps/web/src/shared/store/` (Zustand singleton, chỉ phía client).
- `.agents/knowledge/modules/dashboard/README.md` dòng 91: đổi tên tương ứng.
- `.agents/docs/global/web-ui-direction.md` và `.agents/docs/modules/dashboard/README.md` (tiếng Việt): giải thích lý do chọn Zustand, lý do không persist số tiền, lý do khởi tạo theme trong effect.
- `.agents/docs/README.md`: cập nhật mapping nếu thay đổi.

## 6. Quyết định chờ anh chọn

**LocaleProvider có chuyển luôn không?**
- **Không (mặc định, em đề xuất):** 42 file đang dùng `useLocale`, mỗi lần đổi locale thì toàn bộ đều phải render lại, nên chuyển sang Zustand gần như không có lợi. Locale còn đọc từ cookie, đồng bộ với `next-intl` và `document.documentElement.lang`.
- **Có:** thêm `src/shared/store/locale-store.ts` (state `locale`, `setLocale`, `syncFromCookie`; `useLocale()` trả về `t` suy ra qua `useMemo`), đổi import ở 42 file, bỏ hẳn `LocaleProvider`. Thêm khoảng 1 bước và tăng diff, nhưng rủi ro vẫn ở mức trung bình.

## 7. Rủi ro & rollback

| Rủi ro | Cách giảm |
|---|---|
| Lệch hydration theme | State ban đầu `'light'`, đồng bộ trong effect như hiện tại; script inline vẫn tránh nháy màu |
| Số tiền bị lộ sau F5 | Không dùng `persist`, có test khẳng định mặc định là ẩn |
| `useMoneyVisibility()` trả object mới mỗi lần render | Dùng `useShallow` |
| Đè mất thay đổi chưa commit của task `money-visibility-no-persist` | Làm trên bản working tree hiện tại; logic không persist được giữ nguyên |

Rollback: revert các file đã đổi và gỡ `zustand`. Không có migration hay thay đổi dữ liệu.
