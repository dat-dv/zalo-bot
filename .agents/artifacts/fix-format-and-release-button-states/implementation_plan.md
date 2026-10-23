# Kế hoạch: Sửa lỗi format, đưa refactor button vào main và push

- Route: `implement`, Phase 1 (Planning). Authority: `inspect-and-plan`
- Rủi ro: **LOW** về code (chỉ đổi cách xuống dòng). Thao tác push lên `origin/main` là ra ngoài và khó hoàn tác, nên cần anh duyệt trước.

## 1. "Các lỗi vừa phát hiện" là gì

Ở báo cáo trước, lỗi thực sự duy nhất em nêu ra là **2 file fail `prettier --check`**. Lỗi này đã có từ commit `b2bc47e`, không phải do refactor button gây ra:

| File | Prettier muốn đổi |
| --- | --- |
| `apps/web/src/modules/auth/api/session-user-api.ts` | Gộp lời gọi `httpClient.get<…>(API_ROUTES.sessionMe, { signal })` từ 4 dòng thành 3 dòng |
| `apps/web/src/shared/ui/nav-visibility.ts` | Tách generic `<TItem …, TSection …>` của `visibleNavSections` ra nhiều dòng |

Cả hai chỉ đổi cách xuống dòng, không đổi logic hay type. Workspace `api` và `contracts` đã sạch format.

**Không nằm trong plan này** (trước đó em nêu là "nên xem lại", không phải lỗi):

- Nút 🗑 xoá trong dòng giờ dùng `dangerSoft`.
- Chip đang chọn giờ là nền xanh nhạt.
- Nút "+ Thêm danh mục" giờ là primary.

Nếu anh muốn đổi một trong ba điểm này thì nói em, em sẽ bổ sung vào plan.

## 2. Trạng thái git hiện tại

- `main` = `origin/main` = `f736f90`; đã fetch, remote không có commit mới.
- `refactor/unify-button-states` = `5c67be8`, đi trước `main` 1 commit, merge được không xung đột.
- Tag `v1.0.186` (annotated) mới chỉ có ở local. Remote đã có tới `v1.0.185`.
- `push.followTags=true`, nên `git push` sẽ đẩy kèm tag annotated của các commit được push.
- Hook `.githooks/pre-commit` (`scripts/pre-commit-bump.mjs`):
  - Bỏ qua khi đang merge (có `MERGE_HEAD`), nên merge commit không bump version.
  - Commit thường thì tự bump patch, cập nhật `CHANGELOG.md` và tạo tag.
- Repo không có `.github/workflows`, nên push lên main không tự deploy.

## 3. Các bước (Phase 2, sau khi anh duyệt)

1. **Merge vào main** theo kiểu các lần trước (`--no-ff`, message dạng `Merge <branch>: <tóm tắt>`):
   ```bash
   git checkout main
   git merge --no-ff refactor/unify-button-states -m "Merge refactor/unify-button-states: give every button the same cursor, hover, focus and disabled states" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
   ```
2. **Sửa format**: chạy `npx prettier --write` cho đúng 2 file ở mục 1, không đụng file nào khác.
3. **Kiểm chứng trước khi commit** (`--workspace @zalobot/web`): `format:check`, `typecheck`, `lint`, `test`.
4. **Commit trên main**: `style(web): format session-user-api and nav-visibility with prettier`, kèm `Co-Authored-By`.
   - Hook sẽ tự bump lên **`v1.0.187`**, cập nhật `CHANGELOG.md` và tạo tag `v1.0.187`. Không bump tay.
   - Không cập nhật `.agents/knowledge` hay `.agents/docs`: thay đổi chỉ là format, hành vi giữ nguyên. Sau khi commit, working tree sạch nên docs-drift-check pass.
5. **Push**: `git push origin main`. Lệnh này đẩy `5c67be8`, merge commit, commit format, kèm tag `v1.0.186` và `v1.0.187`.
6. **Xác nhận**:
   - `git rev-list --count origin/main..main` = 0.
   - `git ls-remote --tags origin v1.0.186 v1.0.187` có đủ 2 tag.
   - `git status` sạch.

Branch local `refactor/unify-button-states` được giữ lại. Branch này chưa từng push nên không có gì trên remote phải xoá. Nếu anh muốn, em xoá branch local sau khi merge.

## 4. Rủi ro

| Rủi ro | Cách giảm |
| --- | --- |
| Push main khó hoàn tác | Chạy bước 3 trước khi commit. Kiểm tra lại `origin/main` chưa đổi ngay trước khi push; nếu đã đổi thì dừng và báo anh, không force push |
| UI ở các trang có dữ liệu thật chưa được xem bằng mắt | Không chặn việc push (repo không tự deploy). Nên xem lại sau khi anh deploy |
| Thêm một version `v1.0.187` chỉ vì format | Đây là luồng bình thường của hook. Có thể dùng `SKIP_BUMP=1` để không bump, nhưng em không làm trừ khi anh yêu cầu |
