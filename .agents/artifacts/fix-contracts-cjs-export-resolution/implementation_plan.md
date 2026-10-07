# Kế hoạch sửa lỗi Module Resolution của `@zalobot/contracts` (CommonJS / ESM Compatibility)

Dự án gặp lỗi `Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in /app/node_modules/@zalobot/contracts/package.json` khi container `api` (NestJS) khởi động, khiến backend crash liên tục và không mở được cổng 3000.

## Nguyên nhân

- Backend `apps/api` (NestJS) biên dịch sang CommonJS (`require("@zalobot/contracts")`).
- Package `packages/contracts` khai báo `"type": "module"` và chỉ định nghĩa điều kiện `"import"` trong trường `"exports"` của `package.json`, thiếu `"require"` và `"default"`.
- Khi Node CJS loader thực thi lệnh `require("@zalobot/contracts")`, nó từ chối vì không tìm thấy export phù hợp cho CommonJS.

---

## Thay đổi dự kiến (Proposed Changes)

### Package: `@zalobot/contracts`

#### [MODIFY] [packages/contracts/package.json](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/package.json)

- Bỏ `"type": "module"` để package hoạt động linh hoạt với cả CommonJS và ESM bundler.
- Cập nhật trường `exports` bổ sung đầy đủ `"require"`, `"import"`, `"default"`:
  ```json
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
  ```

#### [MODIFY] [packages/contracts/tsconfig.json](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/tsconfig.json)

- Cập nhật `module` thành `commonjs` và `moduleResolution` thành `node` để `tsc` biên dịch ra mã CommonJS tương thích trực tiếp với NestJS runtime và Next.js compiler.

---

## Kế hoạch kiểm thử & Xác thực (Verification Plan)

### Automated Verification

1. **Kiểm tra build toàn bộ workspace:**
   ```bash
   npm run build
   ```
2. **Kiểm tra require trong CJS runtime từ `apps/api`:**
   ```bash
   node -e 'require("@zalobot/contracts")'
   ```
   _(Xác nhận lệnh chạy thành công với exit code 0, không còn ném lỗi `ERR_PACKAGE_PATH_NOT_EXPORTED`)_
3. **Kiểm tra typecheck toàn dự án:**
   ```bash
   npm run typecheck
   ```

### Manual Verification

- Deploy lại lên server Coolify và xác nhận container `api` và `web` đều ở trạng thái `Up (healthy)` và mở cổng 3000 / 3001 bình thường.
