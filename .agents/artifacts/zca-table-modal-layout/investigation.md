# Chẩn đoán: Modal mở từ bảng /zca bị vỡ layout

> **Đính chính (khi lập plan):** chẩn đoán bên dưới sai so với code hiện tại. Commit `813348b` (HEAD) đã
> render `ThreadStorageLinksDialog` qua `createPortal(…, document.body)`
> (`thread-storage-links-dialog.tsx:51-54`), nên dialog không còn kế thừa `whitespace-nowrap` /
> `text-right` từ ô bảng nữa. Đưa dialog lên `zca-screen` sẽ **không thay đổi gì** → không lập plan đó.
>
> Còn lại hai khả năng:
> 1. Bản đang xem (deploy/dev server) chưa có `813348b` → chỉ cần deploy/chạy lại bản mới nhất.
> 2. Lỗi thật nằm ở `ThreadConfigModal` (mount ở cấp màn hình, không kế thừa CSS của bảng). Các điểm
>    yếu thấy được trong code, chưa xác nhận:
>    - Banner Album Photos (`thread-config-modal.tsx` ~dòng 395): `flex justify-between` không có
>      `flex-wrap`/`min-w-0`; nhãn `<code>` chứa tên nhóm dài không ngắt dòng → tràn ngang, panel hiện
>      cuộn ngang (khác banner Drive đã có `flex-wrap`).
>    - Header: tên nhóm + ID không có `min-w-0`/`truncate`/`break-all` → ID dài đẩy nút ✕ ra ngoài.
>    - Các hàng toggle `flex justify-between` không có `min-w-0` → trên mobile mô tả dài ép toggle.
>
> Cần ảnh chụp hoặc mô tả chỗ vỡ để chọn đúng hướng trước khi lập `implementation_plan.md`.

## Hiện tượng

- Thực tế: mở dialog Drive/Photos từ menu ⋯ của một dòng trong bảng "Zalo & Users" thì nội dung bị vỡ — chữ không xuống dòng (tràn ngang, bị cắt hoặc hiện thanh cuộn ngang), tiêu đề và đoạn mô tả bị căn phải, cỡ chữ nhỏ theo bảng.
- Mong đợi: hiển thị giống hệt khi mở cùng dialog đó từ modal "Cấu hình" (căn trái, chữ tự xuống dòng).
- Môi trường: dashboard web, màn `/zca`. Chưa tái hiện trên trình duyệt vì dev server web không chạy (cổng 3100 là API, 3001 là project khác); kết luận dựa trên code.

## Nguyên nhân gốc

`ThreadStorageLinksDialog` được render **bên trong ô `<td>` cột "Thao tác"**:

- `apps/web/src/modules/zca/presentation/components/chat-table-row.tsx:372`: `<td className="whitespace-nowrap px-3.5 py-2 text-right">`
- `chat-table-row.tsx:386-393`: `<ThreadStorageLinksDialog … />` nằm trong chính ô đó.
- Bảng cha `zca-screen.tsx:630` có `text-xs`.

`Modal` (`apps/web/src/shared/ui/modal.tsx`) dùng `<dialog>` native + `showModal()`. Top layer chỉ đưa dialog lên trên về mặt **hiển thị**; trong DOM nó vẫn là con của `<td>`, nên vẫn **kế thừa CSS kế thừa được** (`white-space: nowrap`, `text-align: right`, `font-size`). Shell `Modal` không reset các thuộc tính này (chỉ có `text-inherit` cho màu).

Hệ quả: mọi đoạn văn, empty-state, form sửa link trong dialog không xuống dòng và bị căn phải.

## Phạm vi ảnh hưởng

| Dialog | Nơi mount | Bị ảnh hưởng? |
| --- | --- | --- |
| `ThreadStorageLinksDialog` mở từ menu ⋯ của dòng | trong `<td>` | **Có** |
| `ThreadStorageLinksDialog` mở từ `ThreadConfigModal` | trong modal cấu hình | Không |
| `ThreadConfigModal`, `SyncMediaModal`, `UserFormDialog`, `MergeUserDialog` | cấp màn hình, `zca-screen.tsx:885+` | Không |

- Lỗi xuất hiện từ commit `7e8e9b5` (dialog được đặt vào ô `text-right whitespace-nowrap`); `813348b` thêm form sửa/xoá link nên càng lộ rõ.
- Không có lỗi logic/dữ liệu, chỉ là CSS.

Độ tin cậy: cao (cơ chế kế thừa CSS của `<dialog>` là hành vi chuẩn; vị trí mount đã xác nhận). Chưa xác nhận bằng ảnh chụp.

## Đề xuất sửa (nhỏ nhất, an toàn)

**Phương án chọn — đưa dialog ra khỏi bảng** (giống cách `ThreadConfigModal`/`SyncMediaModal` đang làm):

1. `chat-table-row.tsx`: bỏ state `storageLinksKind` và phần render `ThreadStorageLinksDialog`; menu Drive/Photos gọi callback mới `onOpenStorageLinks(thread, kind)`.
2. `zca-screen.tsx`: thêm state `storageLinksTarget: { thread, kind } | null`, truyền `onOpenStorageLinks` vào `ChatTableRow`, render `ThreadStorageLinksDialog` ở cấp màn hình cạnh các modal khác.

Phương án phụ (tuỳ chọn, phòng thủ chung): thêm `whitespace-normal text-left` vào className của `<dialog>` trong `shared/ui/modal.tsx` để mọi modal không bị ảnh hưởng bởi nơi mount. Rủi ro thấp nhưng chạm component dùng chung, nên chỉ làm nếu muốn chặn lỗi tương tự ở nơi khác.

## Kiểm chứng

- `npm run typecheck --workspace @zalobot/web`, `npm run lint --workspace @zalobot/web`.
- Thủ công: `/zca` → menu ⋯ một nhóm → Drive/Photos: chữ căn trái, xuống dòng, không cuộn ngang; thử desktop và mobile (< 640px, bottom sheet). Mở cùng dialog từ modal "Cấu hình" để so sánh.
- Không cần cập nhật knowledge/docs (sửa lỗi hiển thị, hành vi nghiệp vụ không đổi).
