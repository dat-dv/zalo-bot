import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  IUpdateProductRequest,
  IUpdateProductTranslationRequest,
  EProductSort,
  IGetProductsParams,
} from '@shared/contracts';

// 1. NESTED DTO CLASS IMPLEMENTING SHARED CONTRACT
export class UpdateProductTranslationDto implements IUpdateProductTranslationRequest {
  @IsString()
  @IsNotEmpty()
  language_id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

// 2. MAIN REQUEST DTO IMPLEMENTING SHARED CONTRACT
export class UpdateProductDto implements IUpdateProductRequest {
  @IsNumber()
  @Min(0)
  @IsOptional()
  base_price?: number;

  @IsNumber()
  @IsOptional()
  status?: number;

  @IsString()
  @IsOptional()
  thumbnail_id?: string | null;

  @IsString()
  @IsOptional()
  brand_id?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  category_ids?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductTranslationDto)
  @IsOptional()
  translations?: UpdateProductTranslationDto[];
}

// 3. QUERY PARAMETERS DTO WITH CLASS-TRANSFORMER
export class GetProductsQueryDto implements IGetProductsParams {
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(EProductSort)
  @IsOptional()
  sort?: EProductSort;

  @IsString()
  @IsOptional()
  category_id?: string;
}
