---
trigger: model_decision
description: Zod Contract-First shape definitions, DTO to ViewModel mapping, snake_case conversion, decimal parsing, date formatting, and logApiDiffError safety.
metadata:
  agent-artifact:
    id: frontend-orchestration-rule-05
    type: rule
    explanation: .agents/system-explain/plugins/frontend-orchestration/rules/05-dto-mapping-and-transformers.md
    depends_on:
      - .claude/skills/frontend-orchestration/rules/01-architecture-and-ddd.md
---

# Zod Contract-First, DTO Mapping, & Data Transformer Rules

## 1. Dual-Case DTO Integration & Schema-Driven Zod Pipeline

API Integration and DTO handling follow a single consistent architecture (`Backend DTO` -> `Zod Safe Parse & Mapper` -> `ViewModel` -> `UI View`), with 2 distinct DTO shape origin cases:

### Case 1: Shared Contract Package Available (`@shared/contracts`)
- **Specialist Plugin Coordination**: Delegate shared DTO contract structures to `.claude/skills/backend-bridge-frontend/`.
- **DTO Shape Source**: Raw API DTO interfaces are imported directly from `@shared/contracts` (`I<Feature>Response`, `I<Feature>Request`).
- **Mapper & Validation**: Zod schema validates `I<Feature>Response` (`satisfies z.ZodType<I<Feature>Response>`) and transforms to `<Feature>ViewModel` in `infrastructure/mappers/<feature>-mapper.ts`.
- **Log Diff Guarantee**: Repositories execute `safeParse(rawData)`. If parsing fails (`!result.success`), `logApiDiffError` logs exact field mismatches to console warnings without crashing the UI.


### Case 2: No Shared Contract Package (Single Source Zod Transformer)

- **DTO Shape Source**: Defined via a single Zod Schema with `.transform()` in `infrastructure/mappers/<feature>-mapper.ts` as the single source of truth.
- **Dual Type Inferring**:
  - `type <Feature>BackendResponseDto = z.input<typeof <feature>ViewModelSchema>` (Raw Backend `snake_case` Shape).
  - `type <Feature>ViewModel = z.output<typeof <feature>ViewModelSchema>` (Clean Web `camelCase` Shape).
- **Log Diff Guarantee**: Repositories execute `safeParse(rawData)` with `.strict()`. If parsing fails (`!result.success`), `logApiDiffError` logs unrecognized keys and field mismatches to console warnings.

```typescript
import { z } from "zod";

// 1. Zod Schema: Validates raw Backend payload AND transforms directly to Web ViewModel
export const userViewModelSchema = z
  .object({
    user_id: z.string(),
    full_name: z.string().nullable().optional(),
    unit_price: z.string().default("0.00"),
    is_active: z.number().int().default(0),
    created_at: z.string().datetime(),
  })
  .strict() // Catches unexpected/extra backend keys automatically
  .transform((dto) => ({
    id: dto.user_id,
    fullName: dto.full_name ?? "N/A",
    isActive: dto.is_active === 1,
    unitPrice: Number(dto.unit_price) || 0,
    formattedPrice: new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(dto.unit_price) || 0),
    createdAtFormatted: new Date(dto.created_at).toLocaleDateString("vi-VN"),
  }));

// 2. Dual Type Inferring (Zero Redundancy)
export type UserResponseDto = z.input<typeof userViewModelSchema>; // Shape Backend (snake_case)
export type UserViewModel = z.output<typeof userViewModelSchema>; // Shape Web (camelCase)
```

- **Mandatory Diff Logging Implementation (`logApiDiffError`)**:
  Repositories MUST NOT silently swallow validation failures or crash on API contract drift. Invoking `logApiDiffError` on `!result.success` is **MANDATORY** for all API response parsing in both Case 1 and Case 2.
  `logApiDiffError` MUST be declared once as a common utility and imported wherever needed:

```typescript
// Shared Common Utility: src/shared/utils/log-api-diff-error.ts
export function logApiDiffError(endpoint: string, error: z.ZodError): void {
  console.warn(`🚨 [API Contract Drift Detected] ${endpoint}`);
  error.issues.forEach((issue) => {
    const fieldPath = issue.path.join(".");
    if (issue.code === "invalid_type") {
      console.warn(
        `   ❌ Field [${fieldPath}]: Expected <${issue.expected}>, received <${issue.received}>`,
      );
    } else if (issue.code === "unrecognized_keys") {
      console.warn(
        `   ⚠️ Unexpected keys from Backend: [${issue.keys.join(", ")}]`,
      );
    } else {
      console.warn(`   ⚠️ Field [${fieldPath}]: ${issue.message}`);
    }
  });
}
```

## 2. Mapper File Location & Naming Conventions

Mapper schemas and functions MUST be located inside `src/modules/<feature>/infrastructure/mappers/<feature>-mapper.ts`.

- **File Naming**: `<feature>-mapper.ts` (e.g. `product-mapper.ts`, `user-mapper.ts`).
- **Schema Naming**: `<feature>ViewModelSchema` (e.g. `userViewModelSchema`).
- **Function Naming (if helper wrapper used)**:
  - `map<Feature>DtoToViewModel(rawData: unknown): <Feature>ViewModel`

## 3. Mandatory Mapping Transformations

Mapper schemas MUST convert raw, un-sanitized backend payload fields into clean, UI-ready ViewModel properties:

1. **Naming Case Conversion**: Convert backend `snake_case` properties (e.g. `product_id`, `created_at`) into TypeScript `camelCase` properties (e.g. `id`, `createdAtFormatted`).
2. **Decimal & Numeric Parsing**: Parse decimal strings (e.g. `unit_price: "150000.00"`) using `Number(dto.unit_price) || 0` to ensure UI components receive clean numbers.
3. **Currency & Locale Formatting**: Pre-format currency and date strings for display (e.g. `formattedPrice: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(priceNumber)`).
4. **Date Parsing**: Format ISO date strings (e.g. `"2026-08-16T15:30:00.000Z"`) to locale date strings (e.g. `"16/08/2026"`).
5. **Flag & Boolean Conversion**: Map integer flags (e.g. `is_active: 1 | 0`) and business logic conditions to booleans (e.g. `isAvailable: dto.is_active === 1 && dto.stock_quantity > 0`).
6. **Null & Undefined Safety**: Provide fallback default values for optional/nullable fields (e.g. `items: (dto.items || []).map(...)`).

## 4. Strict DTO Isolation Guarantee

- Presentation Views (Level 4) and Presentation Components (Level 3) MUST NEVER import or reference `<Feature>BackendResponseDto`.
- Repositories MUST parse raw API responses via Zod transformer schemas before returning data to Application hooks or Presentation Views.

## 5. Zero Cross-Field Semantic Coalescing Ban (Cấm Fallback Lẫn Lộn Trường Dữ Liệu)

TUYỆT ĐỐI KHÔNG sử dụng toán tử `||` hoặc `??` để fallback giữa 2 trường dữ liệu có bản chất ngữ nghĩa khác nhau (như `name || id`, `title || code`, `displayName || externalAccountId`, `email || userId`):

- ❌ **CẤM (Semantic Type Mismatch & UI Degradation)**:
  ```typescript
  // Sai: Trộn lẫn Tên hiển thị (Human string) với Mã định danh kỹ thuật (Technical ID)
  const accountName = account.displayName || account.externalAccountId;
  const label = item.title ?? item.sku;
  const authorName = post.authorName || post.authorId;
  ```

- ⚠️ **Tại sao bị cấm**:
  1. **Lẫn lộn kiểu ngữ nghĩa (Semantic Distortion)**: Biến trường dữ liệu thành kiểu đa hình (polymorphic), gây rủi ro hiển thị dãy ID số thô lên giao diện khi thiếu tên người dùng/thực thể.
  2. **Bug giá trị Falsy**: Nếu `displayName === ""` (chuỗi rỗng), toán tử `||` sẽ tự động nhảy sang `externalAccountId` ngoài ý muốn.
  3. **Rò rỉ Domain Logic vào UI**: Việc xử lý fallback/formatting bắt buộc phải được quy định tường minh tại tầng **ViewModel Transformer / Mapper** hoặc helper format chuyên biệt, không được viết bừa bãi trong UI Component hay Hook.

- ✅ **BẮT BUỘC (Explicit ViewModel Transformation & Semantic Separation)**:
  1. **Chuẩn hóa tại ViewModel Mapper (`infrastructure/mappers/<feature>-mapper.ts`)**:
     ```typescript
     export const accountViewModelSchema = z
       .object({
         display_name: z.string().nullable().optional(),
         external_account_id: z.string(),
       })
       .transform((dto) => ({
         // Đúng ngữ nghĩa: Name là Name, ID là ID
         displayName: dto.display_name?.trim() || null,
         externalAccountId: dto.external_account_id,
         
         // Fallback của Title/Name chỉ được là Placeholder ngữ nghĩa, TUYỆT ĐỐI KHÔNG ghép ID vào
         displayTitle: dto.display_name?.trim() || 'Chưa đặt tên',
       }));
     ```
  2. **Tách bạch UI Render cho 2 trường (Không trộn chung vào 1 chuỗi string)**:
     ```tsx
     // UI hiển thị tách biệt rõ ràng giữa Tên và ID kỹ thuật
     <div className="flex items-center gap-2">
       <span className="font-medium">{account.displayName ?? '(Chưa đặt tên)'}</span>
       <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
         ID: {account.externalAccountId}
       </span>
     </div>
     ```

