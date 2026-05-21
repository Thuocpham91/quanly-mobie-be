import { Controller, Get, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProductPricesService } from './product-prices.service';
import { UpdateProductBranchPriceDto } from './dto/product-price.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('products/:productId/prices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductPricesController {
  constructor(private readonly productPricesService: ProductPricesService) {}

  @Get()
  @Permissions('products.view')
  getPricesForProduct(@Param('productId') productId: string) {
    return this.productPricesService.getPricesForProduct(productId);
  }

  @Put(':branchId')
  @Permissions('products.create_edit')
  setBranchPrice(
    @Param('productId') productId: string,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateProductBranchPriceDto,
  ) {
    console.log(`[ProductPricesController] Setting price for product ${productId} in branch ${branchId} with:`, dto);
    return this.productPricesService.setBranchPrice(productId, branchId, dto);
  }

  @Delete(':branchId')
  @Permissions('products.create_edit')
  deleteBranchPrice(
    @Param('productId') productId: string,
    @Param('branchId') branchId: string,
  ) {
    return this.productPricesService.deleteBranchPrice(productId, branchId);
  }
}
