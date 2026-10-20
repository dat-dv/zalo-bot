# Kế hoạch: Rút ngắn thời gian build Docker khi deploy (Coolify)

- Route: `implement` — Phase 1 (Planning) — Authority: `inspect-and-plan`
- Rủi ro: **MEDIUM** (thay đổi image production của `api`; không đổi code nghiệp vụ)

## 1. Bối cảnh & bằng chứng

Log deploy commit `3a07de5` (2026-10-20 07:10 → 07:15:17, ~5m17s):

| Bước | Thời gian |
| --- | --- |
| `npm ci` api / web (song song) | 55.7s / 44.6s — **không cache** |
| `nest build` / `next build` | 48.5s / 51.1s |
| api runner `COPY node_modules` | 15.2s |
| api `exporting layers` + `unpacking` | **94.5s + 24.6s** |

Nguyên nhân đã xác minh trong repo:

1. **Image `api` chứa toàn bộ `node_modules` của monorepo** (978 packages): `apps/api/Dockerfile` chạy `npm ci` cho mọi workspace (gồm Next.js/React của web) và cả devDependencies, rồi runner `COPY --from=builder /app/node_modules`. Nén layer khổng lồ này (gzip ~1 core) chiếm ~2 phút.
2. **Cache `npm ci` luôn bị phá**: `.githooks/pre-commit` → `scripts/pre-commit-bump.mjs` tăng `"version"` của 4 file `package.json` ở mỗi commit, nên `COPY package.json …` không bao giờ `CACHED` → `npm ci` chạy lại từ đầu mỗi lần deploy.

Ràng buộc cần giữ:
- `apps/api/src/health/deploy-notify.service.ts` đọc `version` từ `package.json` (root + api) và `CHANGELOG.md` lúc runtime → runner **phải giữ `package.json` thật** (chỉ stage cài deps dùng bản đã chuẩn hoá version).
- `@zalobot/contracts` là dependency `file:../../packages/contracts` → runner cần `packages/contracts/package.json` + `dist` (đã có sẵn).
- `sharp` cần binary prebuilt musl (`@img/sharp-linuxmusl-x64`) → không dùng `--ignore-scripts` cho bản prod để tránh rủi ro.

## 2. Phạm vi thay đổi

| File | Thay đổi |
| --- | --- |
| `apps/api/Dockerfile` | Thêm stage `manifests` (chuẩn hoá version) + stage `prod-deps` (chỉ deps runtime của api/contracts); builder cài từ manifests đã chuẩn hoá; runner copy `node_modules` từ `prod-deps` |
| `apps/web/Dockerfile` | Thêm stage `manifests` chuẩn hoá version; builder dùng manifests đó để `npm ci` được cache |
| `.agents/knowledge/global/monorepo-architecture.md` (EN) | Cập nhật mục Docker: cấu trúc stage mới, lý do chuẩn hoá version, image api chỉ chứa prod deps |
| `.agents/docs/global/monorepo-architecture.md` (VI) | Giải thích tương ứng cho developer |

**Không** đổi: `docker-compose.yml`, `.dockerignore`, script bump version, code ứng dụng, cấu hình Coolify.

## 3. Thiết kế chi tiết

### 3.1 Stage `manifests` (dùng chung ý tưởng cho cả 2 Dockerfile)

```dockerfile
FROM node:22-alpine AS manifests
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
# Version auto-bumps on every commit; zero it so dependency layers below stay cached.
RUN node -e "const fs=require('fs');for(const f of ['package.json','apps/api/package.json','apps/web/package.json','packages/contracts/package.json']){const p=JSON.parse(fs.readFileSync(f));p.version='0.0.0';fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')}const l=JSON.parse(fs.readFileSync('package-lock.json'));l.version='0.0.0';for(const k of ['','apps/api','apps/web','packages/contracts'])if(l.packages[k])l.packages[k].version='0.0.0';fs.writeFileSync('package-lock.json',JSON.stringify(l,null,2)+'\n')"
```

Các stage sau dùng `COPY --from=manifests /src/ ./`. `COPY --from` tính cache theo **nội dung file**, nên khi chỉ version đổi, nội dung sau chuẩn hoá giống hệt → `npm ci` được `CACHED`.

### 3.2 `apps/api/Dockerfile`

```
manifests  → (như 3.1)
prod-deps  → COPY --from=manifests; RUN --mount=cache npm ci --omit=dev -w @zalobot/api -w @zalobot/contracts
builder    → COPY --from=manifests; RUN --mount=cache npm ci -w @zalobot/api -w @zalobot/contracts --include-workspace-root=false
             COPY apps/api, packages/contracts; build contracts + api (giữ nguyên lệnh build)
runner     → giữ nguyên phần apk/ENV/EXPOSE, COPY package.json thật + CHANGELOG
             COPY --from=prod-deps /app/node_modules ./node_modules
             (+ apps/api/node_modules nếu npm tạo ra; giữ `mkdir -p` để COPY không lỗi)
             COPY --from=builder contracts/dist, api/dist
```

- Builder không còn cài deps của web (Next.js, React…) → `npm ci` nhanh hơn ngay cả khi cache miss.
- Runner chỉ chứa deps runtime của api + contracts → layer export nhỏ hơn nhiều.

### 3.3 `apps/web/Dockerfile`

- Thêm stage `manifests`; builder `COPY --from=manifests` rồi `npm ci -w @zalobot/web -w @zalobot/contracts` (chỉ deps web + contracts, bỏ deps api như `googleapis`, `tesseract.js`, `zca-js`…).
- Giữ nguyên phần build Next và runner Nginx.

## 4. Rủi ro & phương án dự phòng

| Rủi ro | Kiểm soát |
| --- | --- |
| `npm ci -w …` vẫn cài deps của workspace khác (hành vi npm workspace filter) | Đo số package/kích thước `node_modules` trong image sau build; nếu filter không hiệu lực, fallback: `npm prune --omit=dev` cho runner (vẫn giảm devDeps) và báo lại trước khi làm thêm |
| `npm ci` báo lockfile không khớp sau khi chuẩn hoá version | Chuẩn hoá đồng thời cả `package.json` và `package-lock.json` (root + 3 workspace); kiểm chứng bằng build local |
| Thiếu module runtime (vd. `sharp` binary, package hoisted) khiến api crash | Chạy container api local, kiểm tra `/health` và log khởi động không có `Cannot find module` |
| `deploy-notify` đọc sai version | Runner vẫn copy `package.json` thật (không qua `manifests`) |

## 5. Kiểm chứng (Phase 2)

1. `docker build -f apps/api/Dockerfile .` và `docker build -f apps/web/Dockerfile .` thành công (máy local, Docker 29.8.2).
2. So sánh kích thước image api trước/sau (`docker image ls`) và số thư mục trong `node_modules`.
3. Kiểm tra cache: đổi `version` trong các `package.json` (trong bản tạm, không commit) rồi build lại → bước `npm ci` phải là `CACHED`.
4. Chạy thử container api (cần Postgres/Redis — dùng `docker-compose.local.yml` hoặc chỉ kiểm tra khởi động tới bước kết nối DB, không có lỗi thiếu module). Nếu không chạy đầy đủ được sẽ báo rõ phần chưa kiểm chứng.
5. `node .claude/hooks/docs-drift-check.mjs` exit 0.
6. Thời gian deploy thực tế trên Coolify: anh xác nhận sau khi push (em không push).

Kỳ vọng (ước tính, chưa đo): deploy khi chỉ sửa code FE/BE giảm từ ~5m17s xuống ~2–2.5 phút.

## 6. Ngoài phạm vi (đề xuất riêng nếu cần)

- Chuyển `nest build` sang SWC builder / bỏ typecheck trong `next build` (tiết kiệm thêm ~30–40s, cần CI typecheck thay thế).
- Tắt provenance attestation trên Coolify.
