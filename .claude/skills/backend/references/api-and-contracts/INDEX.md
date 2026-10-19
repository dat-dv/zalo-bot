# API Contracts & Response Formatting (NestJS Real Codebase)

## 📋 Response Standard Format

Tất cả API response thành công đều bọc qua helper `createSuccessResponse(data)` (`src/common/respomse/index.ts`):

```typescript
import { IApiResponse } from '@shared/contracts';

export default function createSuccessResponse<T>(data: T): IApiResponse<T> {
  return {
    status: 'success',
    data,
    message: null,
    timestamp: new Date().toISOString(),
  };
}
```

Dạng JSON trả về Client:
```json
{
  "status": "success",
  "data": { ... },
  "message": null,
  "timestamp": "2026-08-07T00:00:00.000Z"
}
```

## 📄 Pagination Format

Khi API trả về danh sách phân trang, `PaginationService` (`src/shared/services/pagination/pagination.service.ts`) trả về đối tượng `IPaginatedResult<T>`:

```typescript
export interface IPaginatedResult<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

Return type trên Controller: `Promise<IApiResponse<IPaginatedResult<IProductResponse>>>`.
