---
metadata:
  agent-artifact:
    id: docs-global-type-safety
    type: documentation
    depends_on:
      - .agents/knowledge/global/type-safety.md
      - .claude/rules/strict-types.md
---

# Hướng Dẫn Quy Chuẩn Type Safety & Zero-Any

Tài liệu này hướng dẫn chi tiết quy chuẩn cấm tuyệt đối `any` và các phương pháp bypass type safety, ánh xạ trực tiếp với tri thức canonical [`type-safety.md`](../../knowledge/global/type-safety.md).

---

## 1. Tại Sao Tuyệt Đối Không Dùng `any`?

1. **Mất an toàn kiểu dữ liệu**: Sử dụng `any` hoặc `as any` làm mất đi khả năng kiểm tra tĩnh của TypeScript, dẫn đến lỗi runtime nguy hiểm khi truy cập các thuộc tính không tồn tại (`TypeError: Cannot read properties of undefined`).
2. **Lây lan không kiểm soát**: Một biến có kiểu `any` sẽ khiến mọi biến và hàm nhận nó bị suy thoái thành `any`, làm hỏng toàn bộ chuỗi type-check của hệ thống.
3. **Che giấu lỗi thiết kế**: Sử dụng `// @ts-ignore` hay `// @ts-nocheck` chỉ là cách trốn tránh sửa lỗi tạm thời, tích tụ nợ kỹ thuật (technical debt) cho dự án.

---

## 2. Bảng Đối Chiếu Code Cấm vs Code Chuẩn

### 2.1. Xử lý Dữ liệu Chưa Rõ Cấu Trúc (API / JSON)
- ❌ **Cấm**:
  ```typescript
  function parseUser(jsonString: string): any {
    const data: any = JSON.parse(jsonString);
    return data.user;
  }
  ```
- ✅ **Chuẩn**:
  ```typescript
  import { z } from "zod";

  const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
  });

  type User = z.infer<typeof UserSchema>;

  function parseUser(jsonString: string): User {
    const raw: unknown = JSON.parse(jsonString);
    return UserSchema.parse(raw);
  }
  ```

### 2.2. Xử lý Ngoại Lệ trong Khối `catch`
- ❌ **Cấm**:
  ```typescript
  try {
    executeTask();
  } catch (err: any) {
    logger.error(err.message);
  }
  ```
- ✅ **Chuẩn**:
  ```typescript
  try {
    executeTask();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
  }
  ```

### 2.3. Generic & Hàm Tái Sử Dụng
- ❌ **Cấm**:
  ```typescript
  function clone(item: any): any {
    return JSON.parse(JSON.stringify(item));
  }
  ```
- ✅ **Chuẩn**:
  ```typescript
  function clone<T>(item: T): T {
    return JSON.parse(JSON.stringify(item)) as T;
  }
  ```

### 2.4. Đối Tượng Từ Điển (Dictionary / Key-Value)
- ❌ **Cấm**:
  ```typescript
  const metadata: { [key: string]: any } = {};
  ```
- ✅ **Chuẩn**:
  ```typescript
  const metadata: Record<string, unknown> = {};
  ```

---

## 3. Hệ Thống Hook Tự Động Kiểm Soát Vi Phạm

Hệ thống tích hợp sẵn các chốt chặn tự động (Automated Guards):

1. **Tool Hook (`type-safety-guard`)**:
   - Chặn ngay khi Agent sử dụng `write_to_file` hoặc `replace_file_content` nếu đoạn code chứa `:\s*any`, `as any`, `<any>`, `// @ts-ignore`, `// @ts-nocheck`.
2. **Stop Gate (`docs-smart-gate`)**:
   - Khi Agent kết thúc phiên làm việc, hook kiểm tra toàn bộ file TypeScript đã chỉnh sửa trong `git diff`. Nếu phát hiện vi phạm, Agent sẽ bị chặn dừng và nhận được yêu cầu sửa lỗi.
3. **Pre-commit & CI Validation**:
   - Chạy lệnh `npm run agent-system:validate` để quét toàn diện hệ thống.

---

## 4. Xử Lý Sự Cố Khi Gặp Lỗi Type Phức Tạp

| Trường hợp | Giải pháp khuyến nghị |
| --- | --- |
| **Thư viện bên thứ 3 thiếu type** | Tạo file khai báo `types/<package>.d.ts` hoặc sử dụng module augmentation thay vì dùng `as any`. |
| **Cần ép kiểu object sang union type** | Sử dụng Type Predicate Function: `function isSpecialType(obj: unknown): obj is SpecialType`. |
| **Response API trả về nhiều dạng khác nhau** | Sử dụng **Discriminated Union** kết hợp trường phân biệt (ví dụ: `type: 'success' \| 'error'`). |
