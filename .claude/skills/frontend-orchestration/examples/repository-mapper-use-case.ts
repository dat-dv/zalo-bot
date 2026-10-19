import { z } from "zod";

const productDtoSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  price_cents: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
});

type ProductDto = z.infer<typeof productDtoSchema>;

export interface Product {
  id: string;
  name: string;
  priceCents: number;
  createdAt: Date;
}

export const ProductMapper = {
  toDomain(dto: ProductDto): Product {
    return {
      id: dto.id,
      name: dto.display_name,
      priceCents: dto.price_cents,
      createdAt: new Date(dto.created_at),
    };
  },
};

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
}

export class HttpProductRepository implements ProductRepository {
  constructor(private readonly request: (path: string) => Promise<unknown>) {}

  async findById(id: string): Promise<Product | null> {
    const payload = await this.request(`/products/${encodeURIComponent(id)}`);
    if (payload === null) return null;
    return ProductMapper.toDomain(productDtoSchema.parse(payload));
  }
}

// Keep this use case only if the visibility rule belongs to the application.
export class GetVisibleProduct {
  constructor(private readonly products: ProductRepository) {}

  async execute(id: string): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product) throw new Error("Product not found");
    return product;
  }
}
