# NestJS Clean Architecture & Dependency Inversion Guide

## 🧱 Real Module Wiring Pattern

Trong NestJS Backend của dự án, mỗi feature module (`<app-root>/src/api/<feature>/<feature>.module.ts`) kết nối các thành phần như sau:

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { GetProductsUseCase } from './domain/use-cases/get-products.use-case';
import { UpdateProductUseCase } from './domain/use-cases/update-product.use-case';
import { IProductsRepository } from './domain/entities/products.repository.interface';
import { ProductsRepository } from './domain/infrastructure/products.repository';
import { AuthModule } from 'src/api/auth/auth.module';
import { SharedModule } from 'src/shared/shared.module';

@Module({
  imports: [forwardRef(() => AuthModule), SharedModule],
  controllers: [ProductsController],
  providers: [
    GetProductsUseCase,
    UpdateProductUseCase,
    {
      provide: IProductsRepository,
      useClass: ProductsRepository,
    },
  ],
  exports: [
    GetProductsUseCase,
    UpdateProductUseCase,
    IProductsRepository,
  ],
})
export class ProductsModule {}
```

## 🔐 Auth & Permissions Layer

- **AuthGuard**: Rút JWT token từ cookie `access_token` hoặc Authorization Bearer header, verify secret và gán payload vào `req.user`.
- **PermissionsGuard**: Đọc metadata `@Permissions('UPDATE:PRODUCT')` được đặt trên Controller action và đối chiếu với permissions của user.
- **Language Decorator**: Custom decorator `@Language() lang: string` trích xuất `x-language-code` hoặc fallback về `DEFAULT_LANGUAGE_CODE` ('vi').
