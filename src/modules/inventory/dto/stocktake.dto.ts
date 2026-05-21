import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { StocktakeStatus } from '../entities/stocktake.entity';

export class StocktakeItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  systemQuantity: number;

  @IsNumber()
  actualQuantity: number;

  @IsNumber()
  difference: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateStocktakeDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StocktakeItemDto)
  items: StocktakeItemDto[];
}

export class UpdateStocktakeDto {
  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StocktakeItemDto)
  @IsOptional()
  items?: StocktakeItemDto[];
}

export class ApproveStocktakeDto {
  @IsEnum(StocktakeStatus)
  status: StocktakeStatus;
}
