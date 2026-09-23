import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, UseInterceptors, UploadedFile, BadRequestException, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Permissions('products.create_edit')
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Post('import')
  @Permissions('products.create_edit')
  @UseInterceptors(FileInterceptor('file'))
  async importProducts(@UploadedFile() file: any, @Query('branchId') queryBranchId?: string, @Request() req?: any) {
    if (!file?.buffer) {
      throw new BadRequestException('Vui lòng tải lên tệp tin Excel');
    }

    const branchId = queryBranchId ?? req?.body?.branchId ?? req?.query?.branchId;

    return this.productsService.importFromExcel(file.buffer, branchId, req?.user?.id);
  }

  @Get()
  @Permissions('products.view', 'sales.create')
  findAll(
    @Query('isService') isService?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    let filterIsService: boolean | undefined = undefined;
    if (isService === 'true') filterIsService = true;
    if (isService === 'false') filterIsService = false;

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;

    return this.productsService.findAll(filterIsService, pageNumber, limitNumber, search);
  }

  @Get(':id')
  @Permissions('products.view')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('products.create_edit')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    console.log(`[ProductsController] Updating product ${id} with:`, updateProductDto);
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Permissions('products.delete')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
