# Prisma ORM & Database Access Guide (Real Codebase)

## 🗄️ Prisma Querying & Inclusions

Trong Repository class (`src/api/products/domain/infrastructure/products.repository.ts`), các truy vấn phức tạp bao gồm liên kết đa ngôn ngữ và phân trang:

```typescript
private getProductInclude(languageCode: string) {
  return {
    thumbnail: true,
    brand: {
      include: {
        translations: {
          where: { language: { code: languageCode } },
        },
      },
    },
    translations: {
      where: {
        language: { code: languageCode },
      },
    },
  };
}
```

## 🔄 Using PaginationService with Prisma

Repository gọi `PaginationService.paginate`:

```typescript
async findProducts(dto: GetProductsDto, lang: string): Promise<IPaginatedResult<IProductResponse>> {
  const where: Prisma.ProductWhereInput = {
    status: 1,
    deleted_at: null,
  };

  const result = await this.paginationService.paginate(
    this.prisma.product,
    {
      where,
      include: this.getProductInclude(lang),
      orderBy: { created_at: 'desc' },
    },
    dto.page,
    dto.limit,
  );

  return {
    items: result.items.map((item) => this.mapToDomain(item)),
    meta: result.meta,
  };
}
```
