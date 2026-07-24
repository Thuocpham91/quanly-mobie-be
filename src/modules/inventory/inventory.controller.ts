import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import { InventoryService } from './inventory.service';
import { CreateInventoryBatchDto, UpdateInventoryBatchDto, ExportStockDto, TransferStockDto, CreateTransferDto, CreateImportOrderDto, UpdateImportOrderDto } from './dto/inventory.dto';
import { CreateStocktakeDto, UpdateStocktakeDto, ApproveStocktakeDto } from './dto/stocktake.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('sales-rank')
  getSalesRank(@Query('branchId') branchId?: string) {
    return this.inventoryService.getProductSalesRank(branchId);
  }

  @Get('summary')
  getSummary(@Query('branchId') branchId?: string) {
    return this.inventoryService.getInventorySummary(branchId);
  }

  @Get('history')
  getStockHistory(
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    return this.inventoryService.getStockHistory(branchId, pageNum, limitNum);
  }

  @Get('batches')
  findAllBatches(
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    return this.inventoryService.findAllBatches(branchId, pageNum, limitNum);
  }

  @Get('batches/:id')
  findOneBatch(@Param('id') id: string) {
    return this.inventoryService.findOneBatch(id);
  }

  @Post('batches')
  createBatch(@Body() createBatchDto: CreateInventoryBatchDto) {
    return this.inventoryService.createBatch(createBatchDto);
  }

  @Post('batches/bulk')
  createBulkBatches(@Body() createBatchDtos: CreateInventoryBatchDto[]) {
    return this.inventoryService.bulkCreateBatches(createBatchDtos);
  }

  @Patch('batches/:id')
  updateBatch(@Param('id') id: string, @Body() updateBatchDto: UpdateInventoryBatchDto) {
    return this.inventoryService.updateBatch(id, updateBatchDto);
  }

  @Delete('batches/:id')
  deleteBatch(@Param('id') id: string) {
    return this.inventoryService.deleteBatch(id);
  }

  // ==========================================
  // STOCKTAKES (KIỂM KHO)
  // ==========================================
  @Get('stocktakes')
  findAllStocktakes(@Query('branchId') branchId?: string) {
    return this.inventoryService.findAllStocktakes(branchId);
  }

  @Get('stocktakes/:id')
  findOneStocktake(@Param('id') id: string) {
    return this.inventoryService.findOneStocktake(id);
  }

  @Post('stocktakes')
  createStocktake(@Body() createDto: CreateStocktakeDto, @Request() req) {
    return this.inventoryService.createStocktake(createDto, req.user.id);
  }

  @Patch('stocktakes/:id')
  updateStocktake(@Param('id') id: string, @Body() updateDto: UpdateStocktakeDto) {
    return this.inventoryService.updateStocktake(id, updateDto);
  }

  @Patch('stocktakes/:id/approve')
  approveStocktake(@Param('id') id: string, @Body() approveDto: ApproveStocktakeDto, @Request() req) {
    return this.inventoryService.approveStocktake(id, req.user.id, approveDto.status === 'COMPLETED' ? 'COMPLETED' : 'CANCELLED');
  }

  @Post('export')
  exportStock(@Body() exportDto: ExportStockDto, @Request() req) {
    return this.inventoryService.exportStock(exportDto, req.user.id);
  }

  @Get('transfers')
  findAllTransfers(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string
  ) {
    return this.inventoryService.findAllTransfers(branchId, status as any);
  }

  @Get('transfers/:id')
  findOneTransfer(@Param('id') id: string) {
    return this.inventoryService.findOneTransfer(id);
  }

  @Post('transfers')
  createTransfer(@Body() createTransferDto: CreateTransferDto, @Request() req) {
    return this.inventoryService.transferStock(createTransferDto, req.user.id);
  }

  @Post('transfers/:id/confirm')
  confirmTransfer(@Param('id') id: string, @Request() req) {
    return this.inventoryService.confirmTransfer(id, req.user.id);
  }

  @Post('transfers/:id/cancel')
  cancelTransfer(@Param('id') id: string, @Request() req) {
    return this.inventoryService.cancelTransfer(id, req.user.id);
  }

  // Keep compatibility endpoint for other frontend calls if any
  @Post('transfer')
  transferStock(@Body() transferDto: CreateTransferDto, @Request() req) {
    return this.inventoryService.transferStock(transferDto, req.user.id);
  }

  @Post('import-legacy')
  @UseInterceptors(FileInterceptor('file'))
  importLegacy(@UploadedFile() file: any, @Query('branchId') branchId: string, @Request() req) {
    return this.inventoryService.importLegacyFromExcel(file?.buffer, branchId, req.user.id);
  }

  @Post('upload-legacy')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.resolve('uploads', 'legacy');
        if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.floor(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${unique}${ext}`);
      },
    }),
  }))
  uploadLegacy(@UploadedFile() file: any) {
    return { filename: file.filename, path: file.path };
  }

  @Post('process-upload')
  processUpload(@Body('filename') filename: string, @Body('branchId') branchId: string, @Request() req) {
    const filePath = path.resolve('uploads', 'legacy', filename);
    return this.inventoryService.importLegacyFromFile(filePath, branchId, req.user.id);
  }

  // ==========================================
  // IMPORT ORDERS (PHIếU NHậP KHO)
  // ==========================================

  @Get('import-orders')
  findAllImportOrders(
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    return this.inventoryService.findAllImportOrders(branchId, pageNum, limitNum);
  }

  @Get('import-orders/:id')
  findOneImportOrder(@Param('id') id: string) {
    return this.inventoryService.findOneImportOrder(id);
  }

  @Post('import-orders')
  createImportOrder(@Body() dto: CreateImportOrderDto, @Request() req) {
    return this.inventoryService.createImportOrder(dto, req.user.id);
  }

  @Patch('import-orders/:id')
  updateImportOrder(@Param('id') id: string, @Body() dto: UpdateImportOrderDto) {
    return this.inventoryService.updateImportOrder(id, dto);
  }

  @Delete('import-orders/:id')
  deleteImportOrder(@Param('id') id: string) {
    return this.inventoryService.deleteImportOrder(id);
  }
}

