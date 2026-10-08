import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryBatchDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsOptional()
  distributorId?: string;

  @IsNumber()
  @IsNotEmpty()
  importedQuantity: number;

  @IsNumber()
  @IsOptional()
  currentQuantity?: number;

  @IsNumber()
  @IsOptional()
  costPrice?: number;

  @IsNumber()
  @IsOptional()
  lineTotal?: number;

  @IsDateString()
  @IsOptional()
  importDate?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  invoiceName?: string;

  @IsOptional()
  isGift?: boolean;

  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @IsNumber()
  @IsOptional()
  shippingFee?: number;

  @IsString()
  @IsOptional()
  personnelName?: string;

  @IsString()
  @IsOptional()
  itemNote?: string;
}

export class UpdateInventoryBatchDto {
  @IsNumber()
  @IsOptional()
  importedQuantity?: number;

  @IsNumber()
  @IsOptional()
  currentQuantity?: number;

  @IsNumber()
  @IsOptional()
  costPrice?: number;

  @IsNumber()
  @IsOptional()
  lineTotal?: number;

  @IsDateString()
  @IsOptional()
  importDate?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  invoiceName?: string;

  @IsString()
  @IsOptional()
  distributorId?: string;

  @IsString()
  @IsOptional()
  personnelName?: string;

  @IsString()
  @IsOptional()
  itemNote?: string;

  @IsBoolean()
  @IsOptional()
  isGift?: boolean;

  @IsArray()
  @IsOptional()
  imeis?: string[];
}

export class ExportStockDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class TransferStockDto {
  @IsString()
  @IsNotEmpty()
  fromBranchId: string;

  @IsString()
  @IsNotEmpty()
  toBranchId: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class TransferItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}

export class CreateTransferDto {
  @IsString()
  @IsNotEmpty()
  fromBranchId: string;

  @IsString()
  @IsNotEmpty()
  toBranchId: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];
}

// ==========================================
// IMPORT ORDER DTOs
// ==========================================

export class ImportOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsNotEmpty()
  importedQuantity: number;

  @IsNumber()
  @IsOptional()
  costPrice?: number;

  @IsNumber()
  @IsOptional()
  lineTotal?: number;

  @IsArray()
  @IsOptional()
  imeis?: string[];

  @IsString()
  @IsOptional()
  itemNote?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsOptional()
  isGift?: boolean;
}

export class CreateImportOrderDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsOptional()
  distributorId?: string;

  @IsString()
  @IsOptional()
  invoiceName?: string;

  @IsString()
  @IsOptional()
  personnelName?: string;

  @IsDateString()
  @IsOptional()
  importDate?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @IsNumber()
  @IsOptional()
  shippingFee?: number;

  @IsNumber()
  @IsOptional()
  totalAmount?: number;

  @IsNumber()
  @IsOptional()
  paidAmount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportOrderItemDto)
  items: ImportOrderItemDto[];
}

export class UpdateImportOrderDto {
  @IsString()
  @IsOptional()
  distributorId?: string;

  @IsString()
  @IsOptional()
  invoiceName?: string;

  @IsString()
  @IsOptional()
  personnelName?: string;

  @IsDateString()
  @IsOptional()
  importDate?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @IsNumber()
  @IsOptional()
  shippingFee?: number;

  @IsNumber()
  @IsOptional()
  totalAmount?: number;
}
