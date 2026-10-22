# Kế hoạch: Làm lại trang Lịch + lưu sự kiện lịch vào DB

Rủi ro: **HIGH** (thêm bảng DB + migration, đổi nguồn dữ liệu của API lịch, bot Zalo và trang tổng quan, làm lại UI).

## 1. Hiện trạng

### Dữ liệu
- Hệ thống **không lưu sự kiện lịch**. Mọi thao tác đi thẳng vào Google Calendar (`calendarId: 'primary'`) qua `GoogleCalendarService` (`apps/api/src/google/google-calendar.service.ts`).
- `GoogleAuthService.getOAuth2Client(userId)` dùng token riêng của người dùng nếu có, **không có thì dùng tài khoản Google dùng chung** (admin đăng nhập gần nhất). Phần lớn người dùng đang đọc/ghi vào lịch của tài khoản dùng chung.
- Hệ quả, đúng như anh thấy: đổi tài khoản Google (admin `/login` tài khoản khác, hoặc người dùng tự đổi) thì dashboard và bot chỉ còn thấy lịch của tài khoản mới, sự kiện cũ "biến mất" khỏi hệ thống.
- Các nơi đang đọc/ghi Google trực tiếp:
  - Dashboard: `GET/POST/PATCH/DELETE /api/calendar/events` trong `google-resources.controller.ts`.
  - Trang Tổng quan: `reports.controller.ts` (`getCalendarEvents`, 7 ngày tới).
  - Bot Zalo: `today`, `week`, `list-calendar-events`, `delete-calendar-event` (strategy trong `apps/api/src/zalo/text/strategies/`), và lệnh tạo/xoá sau khi duyệt mã trong `transaction-confirmation.service.ts` (`CREATE_CALENDAR_EVENT`, `DELETE_CALENDAR_EVENT`).
- Sự kiện trả về chỉ có: tiêu đề, mô tả, địa điểm, giờ bắt đầu/kết thúc. Không biết ai tạo, tạo từ nhóm nào, có trên Google hay không.

### UI (đã xem trên prod, desktop và 375px)
- **Điện thoại**: thanh công cụ chiếm 3 hàng (Hôm nay / ‹ › / tháng, 3 nút chế độ xem, ô tìm kiếm) trước khi tới nội dung. Chế độ "Lịch trình" chỉ hiện ngày đang chọn và các ngày còn lại **trong tuần đó**, nên hôm nay trống là gần như cả màn hình trống, dù tuần sau có lịch.
- **Desktop**: lưới tháng rộng nhưng chi tiết ngày nằm **dưới** lưới, phải cuộn mới thấy; ô nào nhiều sự kiện thì dài ra, ô trống thì phí chỗ; không có danh sách "sắp tới"; không có nút tạo sự kiện (API tạo đã có nhưng UI chưa dùng).
- Thẻ sự kiện thiếu thông tin: không có thời lượng, người tạo, nhóm Zalo nguồn, trạng thái đồng bộ Google.

## 2. Hướng giải quyết

### 2.1 DB là nguồn sự thật, Google là bản sao
- Sự kiện lịch lưu trong bảng mới `calendar_events`. Dashboard, bot và trang Tổng quan **đọc từ DB**.
- Khi có Google kết nối, hệ thống **đẩy** sự kiện lên Google (để điện thoại vẫn có thông báo nhắc của Google Calendar) và ghi lại `google_event_id` + email tài khoản Google đang giữ bản sao.
- Đổi tài khoản Google thì sự kiện cũ **vẫn còn trong DB**, gắn nhãn "ở tài khoản Google cũ"; sự kiện mới đẩy vào tài khoản mới.
- Sự kiện tạo trực tiếp trên Google (ngoài zalobot) được **nhập vào DB** khi xem lịch (mục 2.3), nên đã thấy một lần là giữ lại mãi.

### 2.2 Bảng `calendar_events` (entity `CalendarEventEntity`, migration mới)
| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | uuid | khoá chính |
| `title` | varchar | |
| `description`, `location` | text / varchar, null | |
| `start_at`, `end_at` | timestamptz | |
| `all_day` | boolean | sự kiện cả ngày của Google |
| `time_zone` | varchar | mặc định cấu hình `timezone` |
| `reminder_minutes` | jsonb (số[]) | mặc định `[60, 30, 10, 0]` như hiện nay |
| `owner_user_id` | varchar, null | xem **Câu hỏi 1** |
| `created_by_user_id`, `created_by_name` | varchar, null | giống `finance_transactions` |
| `source` | varchar | `zalo` \| `dashboard` \| `google` |
| `source_chat_id` | varchar, null | nhóm/chat Zalo tạo ra sự kiện |
| `google_event_id`, `google_account_email` | varchar, null | unique theo cặp (khi khác null) |
| `sync_status` | varchar | `synced` \| `pending` \| `failed` \| `local` (không có Google) |
| `synced_at` | timestamptz, null | |
| `deleted_at` | timestamptz, null | xoá mềm (giữ lịch sử, nhất quán với nhật ký kiểm toán) |
| `created_at`, `updated_at` | timestamptz | |

Index: `(start_at)`, `(owner_user_id, start_at)`, unique `(google_account_email, google_event_id)`.

### 2.3 Backend: module mới `apps/api/src/calendar/`
- `CalendarService`: nơi duy nhất đọc/ghi sự kiện. `GoogleCalendarService` giữ nguyên vai trò client Google.
  - **Tạo**: ghi DB (`pending`) → nếu có Google thì đẩy lên → cập nhật `google_event_id`, email, `synced`. Google lỗi thì để `failed`, sự kiện vẫn lưu và vẫn hiện.
  - **Sửa / Xoá**: sửa DB trước; nếu bản sao Google thuộc tài khoản đang kết nối thì patch/xoá trên Google; thuộc tài khoản cũ thì chỉ đổi DB (không còn quyền vào tài khoản đó).
  - **Đọc**: truy vấn DB theo khoảng thời gian + từ khoá.
  - **Nhập từ Google** (`syncFromGoogle(range)`): kéo sự kiện của tài khoản đang kết nối trong khoảng đang xem, upsert theo `(google_account_email, google_event_id)`, `source = 'google'` nếu là sự kiện mới. Sự kiện của **chính tài khoản đó** trong khoảng đó mà Google không còn trả về thì xoá mềm (người dùng đã xoá trên app Google). Giới hạn tối đa 1 lần / 5 phút cho mỗi tài khoản + khoảng thời gian (khoá Redis) để không gọi Google mỗi lần mở trang.
  - **Đồng bộ lại**: sự kiện `failed`/`pending` được thử đẩy lại khi người dùng bấm "Đồng bộ lại" trên sự kiện, và trong lần nhập kế tiếp.
- `CalendarController`: **giữ nguyên đường dẫn** `/api/calendar/events` (GET, GET :id, POST, PATCH :id, DELETE :id), chuyển khỏi `google-resources.controller.ts`. Thêm `POST /api/calendar/events/:id/resync`. Đường dẫn mới khai báo trong `API_ROUTES`.
- Ghi nhật ký kiểm toán khi tạo/sửa/xoá (bảng `calendar_events` đã có nhãn sẵn trong UI nhật ký).
- Chuyển các nơi gọi sang `CalendarService`: `reports.controller.ts`, 4 strategy của bot, `transaction-confirmation.service.ts` (`CREATE_CALENDAR_EVENT` lưu thêm người tạo + chat nguồn; `DELETE_CALENDAR_EVENT` xoá theo id DB). Strategy `delete-calendar-event` tìm sự kiện trong DB thay vì Google.
- Bỏ điều kiện "chưa kết nối Google thì không tạo được lịch" ở bot: không có Google thì sự kiện vẫn lưu DB (`local`), bot báo rõ là chưa có nhắc trên Google.

### 2.4 Contracts (`packages/contracts`, chỉ thêm trường, không phá vỡ)
`ICalendarEventItem` thêm: `allDay`, `reminderMinutes`, `createdByName`, `source`, `sourceChatName`, `sync: { status, accountEmail, isCurrentAccount }`. `ICreateCalendarEventRequest` thêm `allDay?`, `reminderMinutes?`. Thêm i18n vi/en cho mọi nhãn mới.

### 2.5 Làm lại UI trang Lịch

**Chung**
- Thanh tóm tắt ở đầu trang (dùng `TrendSummaryStrip`/`MetricGrid` sẵn có): *Hôm nay*, *7 ngày tới*, *Tháng này*, *Chưa đồng bộ Google* (bấm vào để lọc).
- Thẻ sự kiện hiện đủ: giờ bắt đầu–kết thúc + thời lượng (hoặc "Cả ngày"), tiêu đề, địa điểm, mô tả rút gọn 2 dòng, người tạo + nhóm Zalo nguồn, nhãn đồng bộ (*Đã lên Google* / *Chỉ lưu trong app* / *Lỗi đồng bộ* / *Ở tài khoản Google cũ*), các mốc nhắc.
- Nút **+ Thêm sự kiện** (form dùng lại `CalendarEventFields`, thêm "Cả ngày" và mốc nhắc). Sửa/xoá trong sheet chi tiết; xoá dùng hộp xác nhận trong app thay `window.confirm` (tổng quát hoá `LogoutConfirmDialog` thành `ConfirmDialog`).
- Sự kiện đã qua hiển thị mờ hơn; sự kiện đang diễn ra có vạch "Đang diễn ra".

**Desktop (> 960px)**
- Một hàng công cụ: `[Hôm nay] [‹] [›] Tháng 10, 2026` · `[Tháng | Danh sách]` · ô tìm kiếm · `[+ Thêm sự kiện]`.
- Bố cục 2 cột: lưới tháng bên trái; **cột phải cố định** gồm "Ngày đã chọn" và "Sắp tới (14 ngày)". Không còn phải cuộn xuống dưới lưới.
- Ô ngày cao đều nhau, tối đa 3 sự kiện rồi "+N"; bấm vào sự kiện mở chi tiết.

**Điện thoại / PWA (≤ 640px)**
- Đầu trang gọn còn 1 hàng: `[‹] Tháng 10, 2026 [›]` + nút Hôm nay + icon tìm kiếm (bấm mới mở ô tìm). Chế độ xem chuyển thành segmented control nhỏ `[Lịch trình | Tháng]`.
- Dải 7 ngày có chấm số sự kiện, vuốt ngang để sang tuần.
- **Lịch trình liền mạch**: ngày đang chọn rồi lần lượt các ngày có sự kiện tiếp theo (14 ngày, không cắt ở cuối tuần). Ngày đang chọn trống chỉ hiện một dòng "Không có sự kiện" rồi vẫn thấy phần sắp tới bên dưới, không còn màn hình trống.
- Nút "+" nổi phía trên thanh tab để thêm sự kiện; form mở dạng sheet toàn màn hình.
- Chế độ "Danh sách" (bảng) chỉ còn trên desktop; trên điện thoại "Lịch trình" đã là danh sách.

### 2.6 Dữ liệu cũ
- Không thể lấy lại sự kiện đang nằm ở tài khoản Google mà hệ thống không còn token. Sau khi triển khai, **tài khoản Google đang kết nối** được nhập vào DB ngay lần đầu mở trang Lịch (nhập 12 tháng trước → 12 tháng sau trong lần đầu). Nếu anh muốn giữ sự kiện của tài khoản cũ: đăng nhập lại tài khoản đó một lần sau khi triển khai rồi đổi về, hệ thống sẽ nhập và giữ lại.

## 3. Câu hỏi cần anh chốt
1. **Lịch dùng chung hay theo người?**
   - **(Đề xuất) Dùng chung như sổ chung**: mọi người xem cùng một lịch, mỗi sự kiện ghi người tạo + nhóm nguồn. Khớp với cách đang chạy thực tế (hầu hết đang dùng chung tài khoản Google của admin) và với sổ tài chính.
   - Theo người: mỗi người chỉ thấy sự kiện mình tạo (`owner_user_id`), admin thấy tất cả.
2. Nút **+ Thêm sự kiện** trên dashboard có làm trong đợt này không? (Đề xuất: có.)
3. Xoá trên app Google thì xoá mềm luôn trong zalobot (đề xuất), hay giữ lại trong zalobot?

## 4. Thứ tự làm
1. Entity + migration `calendar_events`, `CalendarService` + test đơn vị (tạo/sửa/xoá, Google lỗi, tài khoản cũ, nhập và xoá mềm).
2. `CalendarController` (giữ route), contracts, chuyển trang Tổng quan + bot + confirmation sang `CalendarService`.
3. UI: thanh tóm tắt, desktop 2 cột, agenda điện thoại liền mạch, form thêm, sheet chi tiết, `ConfirmDialog`.
4. Tài liệu (Hard Completion Gate): `.agents/knowledge/modules/calendar/` (EN) + `.agents/docs/modules/calendar/` (VI), cập nhật `CONTEXT.md` (thuật ngữ *Sự kiện lịch*, *Bản sao Google*), `.agents/docs/README.md`; `docs-drift-check` phải exit 0.

## 5. Kiểm tra
- `npm run typecheck`, `npm run lint`, `npm run test` (api, web, contracts), `npm run build --workspace @zalobot/web`.
- Chạy migration trên DB local, kiểm tra tạo/sửa/xoá có và không có Google.
- Xem UI ở 375px, 768px và desktop, sáng/tối. Nếu dev server local vẫn bị macOS chặn (`EPERM uv_cwd`), xem trên prod sau khi anh deploy; trên prod chỉ xem, không tạo/xoá dữ liệu thật trừ khi anh cho phép.
