# Kế hoạch: Thông báo khi bật "Kích hoạt Bot lắng nghe"

- Route: implement · Phase 1 (inspect-and-plan) · Rủi ro: **TRUNG BÌNH** (cả API lẫn web, bot gửi tin vào nhóm thật; không đổi schema)
- Anh Đạt đã chọn (17/11/2026): báo **cả hai nơi** (hộp thoại trên dashboard + tin nhắn bot gửi vào Zalo); nội dung trí nhớ **theo cấu hình của kênh**.
- Lý do: "sau này anh sẽ quên". Khi bật nghe, cả admin lẫn thành viên nhóm cần biết bot đang nghe, nhớ những gì, và hỏi lại thế nào.

## 1. Hiện trạng

- Bot bắt đầu nghe một kênh qua 3 đường, cả 3 đều đi qua `ThreadConfigService.updateConfig`:
  - Trang cấu hình kênh: `PUT /api/zca/thread-configs/:id` (form có nút Lưu).
  - Công tắc trên bảng `/zca`: `POST /api/zca/listened-threads/toggle` → `setListened`.
  - Chọn nhiều kênh một lúc: `PUT /api/zca/listened-threads` → `setListenedThreadIds` → `setListened`.
- Hiện không có thông báo nào, cả ở dashboard lẫn trong Zalo.

## 2. Thiết kế

### 2.1 API: bot nhắn vào cuộc trò chuyện khi bắt đầu nghe

- `ThreadConfigService.updateConfig`: ghi lại `isListened` trước khi sửa. Nếu chuyển từ **tắt → bật**, gọi các listener `onListenStarted(config)` sau khi đã lưu DB và Redis. Cùng mẫu với `ChatMemoryService.onChange`. Lỗi trong listener không làm hỏng việc lưu cấu hình.
  - Vì cả 3 đường đều qua `updateConfig`, chỉ có đúng một chỗ phát hiện. Đường PUT gọi `setListened(true)` lần hai, nhưng lúc đó trạng thái đã là bật nên không báo trùng.
  - `loadConfigs` lúc khởi động, `reconcileThreadTypes` và `getConfig` (tạo cấu hình mặc định) không đi qua `updateConfig`, nên khởi động lại API không báo lại.
- Service mới `ListenAnnouncementService` (`apps/api/src/zca/listen-announcement.service.ts`, trong `ZcaModule`):
  - Đăng ký listener khi bootstrap. Gửi tin bằng `ZcaMessengerService` bên trong `OutgoingMemoryKind.run('system', …)`, nên tin này **không vào trí nhớ** và không bao giờ là kết quả tìm kiếm.
  - Chống báo trùng: cùng kênh đã báo trong 10 phút gần nhất thì bỏ qua (map trong RAM), phòng trường hợp admin bật tắt liên tục.
  - Không throw. ZCA chưa đăng nhập hoặc gửi lỗi thì chỉ ghi log cảnh báo.
- Hàm thuần `buildListenAnnouncement(config, botName)` (có spec) dựng nội dung theo cấu hình kênh, dạng chữ thường cho Zalo:

```
👋 Bot đã bắt đầu lắng nghe cuộc trò chuyện này.
💬 Gọi bot: tag @<tên bot> [hoặc bắt đầu tin bằng "<tiền tố>"] rồi nói việc cần làm.

🧠 Trí nhớ: ĐANG BẬT
- Từ bây giờ bot lưu nguyên văn mọi tin của cuộc trò chuyện này (kể cả của người không dùng bot) để trả lời khi được hỏi chuyện cũ, ví dụ "@bot hôm trước hẹn ăn gì?".
- Tin mới được nhớ theo ý nghĩa khoảng 20 giây sau khi nhóm ngớt tin; gõ /sync để nạp ngay.
- [Bot đọc cả chữ trong ảnh để nhớ cùng ảnh.]
- Chỉ nhớ trong cuộc trò chuyện này. Tin thu hồi trên Zalo thì bot quên.
```

Khi trí nhớ đang tắt, phần trí nhớ đổi thành:

```
🧠 Trí nhớ: ĐANG TẮT. Bot không lưu tin nhắn của cuộc trò chuyện này. Admin bật "Nhớ lâu dài" trong Cấu hình kênh trên dashboard.
```

Phần chung ở cuối, luôn có:

```
📌 Dặn bot điều cần luôn nhớ: "@bot nhớ là …"; bảo quên: "@bot quên vụ … đi".
```

  - Dòng "Gọi bot" theo `directInteraction`:
    - chat riêng: không cần tag;
    - nhóm: tag bot, kèm các tiền tố trong `triggerPrefixes` nếu có;
    - `directInteraction.enabled = false`: "bot chỉ nhận lệnh từ người được cấp quyền".
  - Dòng chữ trong ảnh chỉ có khi `readImageText` bật.
  - Tên bot lấy từ `zalo.botName`.

### 2.2 Web: hộp thoại trên trang cấu hình kênh

- `useThreadConfigForm`: sau khi lưu thành công, nếu `isListened` vừa chuyển từ tắt sang bật (so với cấu hình đã lưu trước đó), mở hộp thoại.
- Component mới `ListenStartedDialog` dùng primitive `Modal` sẵn có, nội dung lấy từ hàm thuần `listenStartedSummary(form)` (có spec), cùng logic với tin nhắn Zalo:
  - "✅ Bot đã bắt đầu lắng nghe *<tên kênh>*" và bot sẽ nhắn một tin báo vào cuộc trò chuyện (nếu tài khoản Zalo đang đăng nhập).
  - Trạng thái trí nhớ của kênh:
    - nếu bật: nhớ gì, khi nào, hỏi thế nào, `/sync`, thu hồi là quên, chỉ trong kênh;
    - nếu tắt: bot không lưu gì, bật ở mục 🧠 Nhớ lâu dài bên dưới.
  - Đọc chữ trong ảnh bật hay tắt.
  - Nút "Đã hiểu".
- Bật nghe từ bảng `/zca` (công tắc nhanh hoặc chọn nhiều kênh) thì không có hộp thoại; tin nhắn Zalo vẫn được gửi. Admin vẫn xem lại được ở trang cấu hình kênh.
- Cỡ chữ `text-xs` hoặc `text-sm`, bo góc nhỏ như các hộp thoại khác. Trên điện thoại hộp thoại chiếm toàn chiều ngang.

## 3. File dự kiến sửa

- API:
  - `zca/thread-config.service.ts` (+spec): phát hiện chuyển từ tắt sang bật, `onListenStarted`;
  - `zca/listen-announcement.service.ts` (+spec): file mới;
  - `zca/zca.module.ts`: đăng ký provider.
- Web:
  - `presentation/components/thread-config/use-thread-config-form.ts`, `thread-config-form.tsx`;
  - `listen-started-dialog.tsx`: file mới;
  - `model/listen-started.ts` (+spec): file mới.
- Không đổi contract, route hay schema.

## 4. Kiểm thử

- Unit:
  - nội dung tin theo từng cấu hình (trí nhớ bật/tắt, đọc ảnh, nhóm/riêng, có/không tiền tố, tương tác tắt);
  - chỉ báo khi chuyển từ tắt sang bật, không báo khi đã bật sẵn hay khi tắt;
  - chống báo trùng trong 10 phút;
  - gửi lỗi không làm hỏng việc lưu cấu hình.
- Web: spec cho `listenStartedSummary`.
- Chạy `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- Thử tay trên local (nếu có ZCA): bật nghe một kênh thử → hộp thoại hiện ra và bot nhắn đúng một tin; tắt rồi bật lại trong 10 phút → không nhắn lại.

## 5. Tài liệu

- `.agents/knowledge/modules/zca/README.md` + `.agents/docs/modules/zca/README.md`: hành vi khi bật nghe.
- `modules/zca/chat-memory.md` (EN/VI): tin báo khi bật nghe là kiểu `system`, không vào trí nhớ.
- `CONTEXT.md`: thêm thuật ngữ "Tin báo lắng nghe".

## 6. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Chọn nhiều kênh trên `/zca` làm bot nhắn hàng loạt vào nhiều nhóm | Đúng yêu cầu (mỗi kênh mới nghe được báo một lần). Chống trùng 10 phút. Nếu anh muốn chỉ báo khi bật từ trang cấu hình thì đổi lại dễ |
| Tin báo lọt vào trí nhớ | Gửi với kiểu `system`, không vào trí nhớ |
| Nhóm thấy tin báo là phiền | Chỉ gửi khi bật nghe, không gửi khi đổi cấu hình khác |
