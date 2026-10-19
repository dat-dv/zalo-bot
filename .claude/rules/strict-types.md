<!-- Ported verbatim from Base Agents `.agents/rules/strict-types.md` (Gemini/Antigravity). Tool names mapped per CLAUDE.md. Always loaded. -->

# Strict Type Safety & Zero-Any Rule

## 1. Nguyên Tắc Cốt Lõi: Zero Any Policy (Cực Kỳ Nghiêm Trọng)

Tuyệt đối KHÔNG sử dụng kiểu dữ liệu `any` hoặc bất kỳ cơ chế nào nhằm qua mặt hệ thống kiểm tra kiểu (Type System Bypass) trong toàn bộ mã nguồn TypeScript (`.ts`, `.tsx`, `.mts`, `.cts`).

Mọi đoạn mã vi phạm sẽ bị **chặn tự động** bởi `type-safety-guard` hook và từ chối merge/hoàn thành task.

---

## 2. Danh Mục Các Hành Vi Bị Nghiêm Cấm

| STT | Cú pháp / Hành vi bị cấm | Lý do cấm | Giải pháp bắt buộc |
| --- | --- | --- | --- |
| 1 | Khai báo kiểu `: any`, `any[]`, `Array<any>` | Vô hiệu hóa toàn bộ cơ chế type-check của TypeScript | Sử dụng kiểu tường minh, `unknown`, hoặc Generic `<T>` |
| 2 | Ép kiểu `as any`, `<any>` | Phá vỡ an toàn kiểu dữ liệu tại runtime | Sử dụng Type Narrowing, Type Guard, hoặc Zod schema parsing |
| 3 | Khai báo từ điển `Record<string, any>`, `Record<any, any>` | Mất kiểm soát cấu trúc đối tượng | Dùng `Record<string, unknown>` kết hợp runtime validation |
| 4 | Comment bypass: `// @ts-ignore`, `// @ts-nocheck` | Ẩn giấu lỗi type thay vì sửa tận gốc | Khắc phục triệt để lỗi type hoặc bổ sung declaration (`.d.ts`) |
| 5 | Comment tắt linter: `eslint-disable ... no-explicit-any` | Trốn tránh quy chuẩn chất lượng mã nguồn | Định nghĩa interface/type chuẩn xác |
| 6 | Sử dụng kiểu mơ hồ: `Function`, `Object`, `{}` | Không mô tả rõ ràng signature hoặc thuộc tính | Dùng `(...args: unknown[]) => unknown` hoặc interface cụ thể |
| 7 | Ép kiểu 2 tầng mù quáng: `(x as unknown as TargetType)` | Giả định sai lệch về dữ liệu không được kiểm chứng | Dùng hàm kiểm tra kiểu `x is TargetType` hoặc Zod `.safeParse()` |
| 8 | Bắt lỗi untyped: `catch (err: any)` hoặc `catch (err)` truy cập thuộc tính ngay | Runtime Error nếu error không phải Error instance | Dùng `catch (err: unknown)` và kiểm tra `err instanceof Error` |

---

## 3. Mẫu Thiết Kế Thay Thế Chuẩn (Standard Safe Patterns)

### 3.1. Dữ liệu Đầu Vào Không Xác Định (API, JSON, User Input)
❌ **SAI (Cấm tuyệt đối)**:
```typescript
function handleResponse(data: any) {
  return data.items.map((x: any) => x.name);
}
```

✅ **ĐÚNG (Sử dụng Zod Schema hoặc Type Guard)**:
```typescript
import { z } from "zod";

const ItemSchema = z.object({
  name: z.string(),
});
const ResponseSchema = z.object({
  items: z.array(ItemSchema),
});

function handleResponse(data: unknown): string[] {
  const parsed = ResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Dữ liệu không hợp lệ: ${parsed.error.message}`);
  }
  return parsed.data.items.map((x) => x.name);
}
```

### 3.2. Bắt Lỗi An Toàn trong Khối `catch`
❌ **SAI (Cấm tuyệt đối)**:
```typescript
try {
  doSomething();
} catch (error: any) {
  console.error(error.message);
}
```

✅ **ĐÚNG (Xử lý `unknown` an toàn)**:
```typescript
try {
  doSomething();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
}
```

### 3.3. Hàm Tổng Quát (Generics)
❌ **SAI (Cấm tuyệt đối)**:
```typescript
function getFirst(items: any[]): any {
  return items[0];
}
```

✅ **ĐÚNG (Sử dụng Generic Type)**:
```typescript
function getFirst<T>(items: readonly T[]): T | undefined {
  return items[0];
}
```

### 3.4. Đối Tượng Key-Value Linh Hoạt
❌ **SAI (Cấm tuyệt đối)**:
```typescript
interface DynamicConfig {
  [key: string]: any;
}
```

✅ **ĐÚNG (Sử dụng `unknown` hoặc Generic Constraint)**:
```typescript
type DynamicConfig = Record<string, unknown>;

function getConfigValue<T>(config: DynamicConfig, key: string, guard: (val: unknown) => val is T): T | null {
  const value = config[key];
  return guard(value) ? value : null;
}
```

---

## 4. Cơ Chế Kiểm Soát Tự Động (Hooks & Quality Gates)

1. **PreToolUse Hook (`type-safety-guard`)**:
   - Chặn ngay tại thời điểm gọi tool nếu phát hiện cú pháp `any` hoặc comment bypass type trong các file TypeScript.
2. **Stop Hook**:
   - Quét toàn bộ thay đổi (`git diff`) trước khi dừng task. Nếu phát hiện vi phạm chưa được xử lý, Agent sẽ bị buộc phải tiếp tục sửa.
3. **Continuous Validation**:
   - `node .claude/hooks/docs-drift-check.mjs --all` và pre-commit hook luôn kiểm tra tính toàn vẹn và mức độ tuân thủ quy chuẩn Zero-Any.
