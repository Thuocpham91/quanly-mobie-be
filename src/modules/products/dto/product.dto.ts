import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class ProductUnitDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  unitId: string;

  @IsNumber()
  @IsNotEmpty()
  conversionFactor: number;

  @IsOptional()
  isDefault?: boolean;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsOptional()
  productCode?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  itemGroupId?: string;

  @IsString()
  @IsOptional()
  classificationId?: string;

  @IsString()
  @IsOptional()
  unitId?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProductUnitDto)
  units?: ProductUnitDto[];

  @IsString()
  @IsOptional()
  usage?: string;

  @IsNumber()
  @IsOptional()
  basePrice?: number;

  @IsBoolean()
  @IsOptional()
  isService?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
