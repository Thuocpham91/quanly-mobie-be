import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, PaymentMethod } from '../entities/order.entity';

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Type(() => Number)
  unitPrice: number;
}

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  walletCreditAmount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
