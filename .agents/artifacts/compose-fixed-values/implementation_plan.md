# Kế hoạch: Ghi cứng giá trị cố định trong docker-compose.yml

- Route: implement · Phase 1 (Planning) · Rủi ro: LOW–MEDIUM (đổi file deploy production, nhưng giá trị chạy thực tế không đổi)
- Phạm vi: `docker-compose.yml`, docs env/monorepo (`.agents/knowledge/global/` + `.agents/docs/global/`). Không đụng `docker-compose.local.yml`, vì Coolify không dùng file này.

## Vấn đề

Coolify tự tạo env cho mọi `${TÊN:-mặc định}` trong `docker-compose.yml`, và không cho xoá các env đó ("Please remove it from the Docker Compose file first"). Có 5 biến bị khoá như vậy, dù giá trị của chúng trên production là cố định và không nên đổi:

| Biến | Dòng compose | Vì sao phải cố định |
| --- | --- | --- |
| `DATA_DIR` | `api.environment` | Volume mount cứng `./data:/app/data`. Đặt khác `/app/data` thì phiên ZCA và các file cấu hình ghi ra chỗ không được mount, mất mỗi lần deploy. |
| `DATABASE_SSL` | `api.environment` | Postgres nằm trong cùng compose và không bật SSL, nên luôn là `false`. |
| `TYPEORM_SYNCHRONIZE` | `api.environment` | Bật `true` trên prod thì TypeORM tự sửa schema, bỏ qua migration. Không bao giờ được bật. |
| `POSTGRES_DB`, `POSTGRES_USER` | `postgres.environment`, `api.DATABASE_URL` | Đổi sau khi đã có volume dữ liệu thì Postgres không tạo lại DB/user, khiến API không kết nối được. |
| `NEXT_PUBLIC_API_URL` | `web.build.args` | Web và API cùng domain (Nginx của web proxy `/api`), nên web dùng URL tương đối. |

## Thay đổi `docker-compose.yml`

```yaml
postgres:
  environment:
    POSTGRES_DB: zalobot
    POSTGRES_USER: zalobot
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?...}      # giữ
api:
  environment:
    DATABASE_URL: postgresql://zalobot:${POSTGRES_PASSWORD:?...}@postgres:5432/zalobot
    DATABASE_SSL: 'false'
    TYPEORM_SYNCHRONIZE: 'false'
    DATA_DIR: /app/data
web:
  build:
    # bỏ hẳn args NEXT_PUBLIC_API_URL; Dockerfile vẫn giữ ARG cho ai build tay
```

Giữ `${...}` cho các biến thật sự cần chọn: `POSTGRES_PASSWORD`, `BE_PORT`, `DEFAULT_TIMEZONE`, `NGINX_PORT`, `POSTGRES_PORT`, `REDIS_PORT`.

Giá trị chạy thực tế không đổi: hiện Coolify đang đặt `DATA_DIR=./data`, và vì cwd của container là `/app` nên đường dẫn thật đã là `/app/data`. `DATABASE_SSL`/`TYPEORM_SYNCHRONIZE` đang là `false`, `POSTGRES_DB`/`POSTGRES_USER` đang là `zalobot`. Web sau khi bỏ `NEXT_PUBLIC_API_URL` sẽ gọi API bằng URL tương đối, cùng domain như hiện tại.

## Docs

- `environment-guard.md` (EN + VI): ghi rõ `DATA_DIR`, `DATABASE_SSL`, `TYPEORM_SYNCHRONIZE`, `POSTGRES_DB`, `POSTGRES_USER` được compose ghi cứng trên production; env của chúng chỉ có tác dụng khi chạy ngoài compose (dev). Bỏ ý "build arg `NEXT_PUBLIC_API_URL` trong compose". Danh sách biến Coolify khoá còn `BE_PORT`, `DEFAULT_TIMEZONE`, `NGINX_PORT`, `POSTGRES_PASSWORD`.
- `monorepo-architecture.md` (EN + VI): sửa đoạn "đặt `NEXT_PUBLIC_API_URL` trước khi build Docker web" và mô tả service `web` (không còn build arg).

## Sau khi deploy (anh làm trên Coolify)

Xoá `DATA_DIR`, `DATABASE_SSL`, `TYPEORM_SYNCHRONIZE`, `POSTGRES_DB`, `POSTGRES_USER`, `NEXT_PUBLIC_API_URL`. Có thể phải deploy bản mới xong thì Coolify mới mở khoá các biến này.

## Kiểm tra

- `POSTGRES_PASSWORD=x docker compose -f docker-compose.yml config`: compose hợp lệ, và `api.environment` ra đúng `DATA_DIR=/app/data`, `DATABASE_SSL=false`, `TYPEORM_SYNCHRONIZE=false`, `DATABASE_URL` trỏ `postgres:5432/zalobot`.
- `node .claude/hooks/docs-drift-check.mjs`.
- Chưa chạy được: deploy thật trên Coolify.

## Ghi chú ngoài phạm vi

- `postgres` và `redis` đang mở cổng ra host (`5432`, `6379`), và Redis không có mật khẩu. Nếu server không chặn hai cổng này bằng firewall thì ai cũng kết nối được từ ngoài. Kế hoạch không sửa phần này; nếu anh muốn thì làm riêng.
