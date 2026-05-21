import { IsNumber, IsNotEmpty } from 'class-validator';

export class UpdateProductBranchPriceDto {
  @IsNumber()
  @IsNotEmpty()
  price: number;
}
