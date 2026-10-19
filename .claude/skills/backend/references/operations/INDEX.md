# Operational Services & Scripting Map (Backend)

## 🗺️ Core Service Providers

- `PrismaService`: `src/shared/services/prisma/prisma.service.ts`
- `PaginationService`: `src/shared/services/pagination/pagination.service.ts`
- `GlobalExceptionFilter`: `src/common/filters/global-exception.filter.ts`
- `ResponseInterceptor`: `src/common/intercepters/response.interceptor.ts`
- `createSuccessResponse`: `src/common/respomse/index.ts`

## 🛠️ CLI Operations

```bash
# Type check backend
npm run typecheck

# Fix linting
npm run lint

# Database migration
npx prisma migrate dev
```
