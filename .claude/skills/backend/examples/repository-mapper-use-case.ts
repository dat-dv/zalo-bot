import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/shared/services/prisma/prisma.service";
import { PaginationService } from "@/shared/services/pagination/pagination.service";
import {
  IProductResponse,
  IGetProductsParams,
  IPaginatedResult,
} from "@shared/contracts";

// 1. REPOSITORY INTERFACE & SYMBOL TOKEN
export const IProductsRepository = Symbol("IProductsRepository");

export interface IProductsRepository {
  findById(id: string, languageCode?: string): Promise<IProductResponse | null>;
  findPaginated(
    params: IGetProductsParams,
    languageCode?: string,
  ): Promise<IPaginatedResult<IProductResponse>>;
}

interface IPrismaRawProduct {
  id: string;
  name?: string;
  slug: string;
  base_price?: number | string | { toString(): string } | null;
  status: string;
  created_at?: Date | null;
  thumbnail?: { url?: string | null } | null;
  translations?: Array<{ name?: string }>;
}

// 2. PRISMA REPOSITORY IMPLEMENTATION (Real Codebase Pattern)
@Injectable()
export class ProductsRepository implements IProductsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
  ) {}

  private mapToDomain(raw: IPrismaRawProduct): IProductResponse {
    return {
      id: raw.id,
      name: raw.name || raw.translations?.[0]?.name || "",
      slug: raw.slug,
      base_price: raw.base_price ? Number(raw.base_price) : 0,
      status: raw.status,
      created_at: raw.created_at?.toISOString(),
      thumbnail_url: raw.thumbnail?.url || null,
    };
  }

  async findById(
    id: string,
    languageCode = "vi",
  ): Promise<IProductResponse | null> {
    const raw = await this.prisma.product.findUnique({
      where: { id },
      include: {
        thumbnail: true,
        translations: {
          where: { language: { code: languageCode } },
        },
      },
    });
    if (!raw) return null;
    return this.mapToDomain(raw);
  }

  async findPaginated(
    params: IGetProductsParams,
    languageCode = "vi",
  ): Promise<IPaginatedResult<IProductResponse>> {
    const page = params.page || 1;
    const limit = params.limit || 10;

    const result = await this.paginationService.paginate(
      this.prisma.product,
      {
        where: params.category_id
          ? { category_id: params.category_id }
          : undefined,
        include: {
          thumbnail: true,
          translations: {
            where: { language: { code: languageCode } },
          },
        },
        orderBy: { created_at: "desc" },
      },
      page,
      limit,
    );

    return {
      items: result.items.map((item) => this.mapToDomain(item)),
      meta: result.meta,
    };
  }
}

// 3. USE CASE IMPLEMENTATION
@Injectable()
export class GetProductDetailUseCase {
  constructor(
    @Inject(IProductsRepository)
    private readonly productsRepository: IProductsRepository,
  ) {}

  async execute(
    productId: string,
    languageCode = "vi",
  ): Promise<IProductResponse> {
    const product = await this.productsRepository.findById(
      productId,
      languageCode,
    );
    if (!product) {
      throw new NotFoundException(
        `Product with ID '${productId}' was not found`,
      );
    }
    return product;
  }
}
