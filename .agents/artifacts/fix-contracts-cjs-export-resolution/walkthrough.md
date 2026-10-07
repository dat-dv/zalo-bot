# Walkthrough: Sửa lỗi Module Resolution `@zalobot/contracts` (CommonJS / ESM)

Đã khắc phục hoàn toàn lỗi `Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in @zalobot/contracts/package.json` khiến container `api` (NestJS) bị crash lúc khởi động.

---

## Các thay đổi đã thực hiện (Changes Made)

### Package: `@zalobot/contracts`

- [packages/contracts/package.json](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/package.json):
  - Bỏ thuộc tính `"type": "module"`.
  - Cập nhật trường `exports` để hỗ trợ cả `"require"`, `"import"`, và `"default"`:
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
- [packages/contracts/tsconfig.json](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/tsconfig.json):
  - Chuyển `module` sang `commonjs` và `moduleResolution` sang `node` để `tsc` sinh ra file `.js` tương thích với CommonJS runtime của NestJS backend.

---

## Kết quả kiểm thử & Xác thực (Verification Results)

### 1. Build toàn bộ Workspace

```bash
npm run build
```

- `@zalobot/contracts`: Biên dịch TypeScript thành công (`dist/index.js`, `dist/index.d.ts`).
- `@zalobot/api`: NestJS build thành công (`dist/main.js`).
- `@zalobot/web`: Next.js static build thành công (`out/` tĩnh cho 8 routes).

### 2. Kiểm tra CJS Runtime Require trong `apps/api`

```bash
node -e 'const contracts = require("@zalobot/contracts"); console.log("SUCCESS:", Object.keys(contracts));'
```

**Kết quả:**

```text
SUCCESS: [
  'API_ROUTES',
  'APP_ROUTES',
  'SUPPORTED_LOCALES',
  'DEFAULT_LOCALE',
  'normalizeLocale',
  'localeTag',
  'translate'
]
```

### 3. Typecheck & System Validation

- `npm run typecheck`: **Pass 100%** không có lỗi type.
- `npm run agent-system:validate`: **Pass 100%** (81 artifacts, 0 cyclic errors).
