import { Injectable, NotFoundException } from '@nestjs/common';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { InventoryBatch } from './entities/inventory-batch.entity';
import { InventoryLog, StockMovementType } from './entities/inventory-log.entity';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { Product } from '../products/entities/product.entity';
import { Distributor } from '../distributors/entities/distributor.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { CreateInventoryBatchDto, UpdateInventoryBatchDto, ExportStockDto, TransferStockDto, CreateTransferDto, CreateImportOrderDto, UpdateImportOrderDto } from './dto/inventory.dto';
import { CreateStocktakeDto, UpdateStocktakeDto } from './dto/stocktake.dto';
import { Stocktake, StocktakeStatus } from './entities/stocktake.entity';
import { StocktakeItem } from './entities/stocktake-item.entity';
import { InventoryTransfer, TransferStatus } from './entities/inventory-transfer.entity';
import { InventoryTransferItem } from './entities/inventory-transfer-item.entity';
import { InventoryImportOrder } from './entities/inventory-import-order.entity';
import { parseLegacyImportRow } from './legacy-import.util';

export interface InventorySummary {
  product: Product;
  totalImported: number;
  totalStock: number;
  averageCost: number;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryBatch)
    private inventoryRepository: Repository<InventoryBatch>,
    @InjectRepository(InventoryLog)
    private inventoryLogRepository: Repository<InventoryLog>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Distributor)
    private distributorRepository: Repository<Distributor>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Stocktake)
    private stocktakeRepository: Repository<Stocktake>,
    @InjectRepository(StocktakeItem)
    private stocktakeItemRepository: Repository<StocktakeItem>,
    @InjectRepository(InventoryTransfer)
    private transferRepository: Repository<InventoryTransfer>,
    @InjectRepository(InventoryTransferItem)
    private transferItemRepository: Repository<InventoryTransferItem>,
    @InjectRepository(InventoryImportOrder)
    private importOrderRepository: Repository<InventoryImportOrder>,
  ) {}

  // ==========================================
  // INVENTORY BATCH & SUMMARY
  // ==========================================
  async findAllBatches(branchId?: string, page = 1, limit = 10): Promise<PaginatedResult<InventoryBatch>> {
    if (branchId === 'undefined' || branchId === 'null' || !branchId) {
      branchId = undefined;
    }
    const whereClause = branchId ? { branchId } : {};
    const skip = (page - 1) * limit;

    const [data, total] = await this.inventoryRepository.findAndCount({
      where: whereClause,
      relations: ['product', 'product.category', 'product.itemGroup', 'distributor'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOneBatch(id: string): Promise<InventoryBatch> {
    const batch = await this.inventoryRepository.findOne({ 
      where: { id }, 
      relations: ['product', 'product.category', 'product.itemGroup', 'distributor'] 
    });
    if (!batch) {
      throw new NotFoundException(`Batch with ID ${id} not found`);
    }
    return batch;
  }

  async getInventorySummary(branchId?: string): Promise<InventorySummary[]> {
    // Sanitize branchId - sometimes frontend sends "undefined" as a string
    if (branchId === 'undefined' || branchId === 'null' || !branchId) {
      branchId = undefined;
    }

    // Get all products
    const products = await this.productsRepository.find({ 
      order: { name: 'ASC' },
      relations: ['category', 'itemGroup', 'unit']
    });
    
    // Get batches, optionally filtered by branch
    const whereClause = branchId ? { branchId } : {};
    const batches = await this.inventoryRepository.find({
      where: whereClause
    });

    // Group batches by productId and calculate totals
    const summary: InventorySummary[] = products.map(product => {
      const productBatches = batches.filter(b => b.productId === product.id);
      
      let totalImported = 0;
      let totalStock = 0;
      let totalValue = 0;

      productBatches.forEach(batch => {
        totalImported += batch.importedQuantity;
        totalStock += batch.currentQuantity;
        totalValue += (batch.currentQuantity * Number(batch.costPrice)); // costPrice might be a string from numeric column
      });

      const averageCost = totalStock > 0 ? totalValue / totalStock : 0;

      return {
        product,
        totalImported,
        totalStock,
        averageCost
      };
    });

    return summary;
  }

  async createBatch(createDto: CreateInventoryBatchDto): Promise<InventoryBatch> {
    const batch = this.inventoryRepository.create({
      ...createDto,
      currentQuantity: createDto.currentQuantity ?? createDto.importedQuantity,
    });
    const saved = await this.inventoryRepository.save(batch);

    // Cập nhật giá nhập (basePrice) của sản phẩm theo giá nhập mới nhất
    if (createDto.costPrice != null && createDto.costPrice > 0) {
      await this.productsRepository.update(createDto.productId, { basePrice: createDto.costPrice });
    }

    return saved;
  }

  async bulkCreateBatches(createDtos: CreateInventoryBatchDto[]): Promise<InventoryBatch[]> {
    const batches = createDtos.map(dto => this.inventoryRepository.create({
      ...dto,
      currentQuantity: dto.currentQuantity ?? dto.importedQuantity,
    }));
    const saved = await this.inventoryRepository.save(batches);

    // Cập nhật giá nhập (basePrice) của từng sản phẩm theo giá nhập mới nhất
    for (const dto of createDtos) {
      if (dto.costPrice != null && dto.costPrice > 0) {
        await this.productsRepository.update(dto.productId, { basePrice: dto.costPrice });
      }
    }

    return saved;
  }

  async updateBatch(id: string, updateDto: UpdateInventoryBatchDto): Promise<InventoryBatch> {
    const batch = await this.inventoryRepository.findOne({ where: { id } });
    if (!batch) {
      throw new NotFoundException(`Batch with ID ${id} not found`);
    }
    await this.inventoryRepository.update(id, updateDto);
    return this.inventoryRepository.findOne({ where: { id }, relations: ['product', 'distributor'] }) as Promise<InventoryBatch>;
  }

  async deleteBatch(id: string): Promise<void> {
    const batch = await this.inventoryRepository.findOne({ where: { id } });
    if (!batch) {
      throw new NotFoundException(`Batch with ID ${id} not found`);
    }
    await this.inventoryRepository.remove(batch);
  }

  async deductStock(
    productId: string,
    branchId: string,
    quantity: number,
    referenceCode: string,
    userId: string,
  ): Promise<void> {
    if (quantity <= 0) return;

    const batches = await this.inventoryRepository.find({
      where: {
        productId,
        branchId,
        currentQuantity: MoreThan(0),
      },
      order: {
        expiryDate: 'ASC',
        createdAt: 'ASC',
      },
    });

    let remainingToDeduct = quantity;

    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;

      const deductAmount = Math.min(batch.currentQuantity, remainingToDeduct);
      batch.currentQuantity -= deductAmount;
      remainingToDeduct -= deductAmount;

      await this.inventoryRepository.save(batch);

      const log = this.inventoryLogRepository.create({
        productId,
        branchId,
        type: StockMovementType.SALE,
        quantity: -deductAmount,
        batchId: batch.id,
        referenceCode,
        note: `Bán ${deductAmount} sản phẩm qua đơn hàng ${referenceCode}`,
        createdById: userId,
      });
      await this.inventoryLogRepository.save(log);
    }

    if (remainingToDeduct > 0) {
      const log = this.inventoryLogRepository.create({
        productId,
        branchId,
        type: StockMovementType.SALE,
        quantity: -remainingToDeduct,
        referenceCode,
        note: `Bán vượt kho ${remainingToDeduct} sản phẩm qua đơn hàng ${referenceCode}`,
        createdById: userId,
      });
      await this.inventoryLogRepository.save(log);
    }
  }

  async getStockHistory(branchId?: string, page = 1, limit = 10): Promise<{ data: any[]; total: number }> {
    if (branchId === 'undefined' || branchId === 'null' || !branchId) {
      branchId = undefined;
    }
    const whereClause = branchId ? { branchId } : {};
    const [data, total] = await this.inventoryLogRepository.findAndCount({
      where: whereClause,
      relations: ['product', 'createdBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  // Returns a map of productId -> totalQuantitySold (from COMPLETED orders only)
  async getProductSalesRank(branchId?: string): Promise<Record<string, number>> {
    const qb = this.orderItemRepository.createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .select('oi.productId', 'productId')
      .addSelect('SUM(oi.quantity)', 'totalSold')
      .where('o.status = :status', { status: 'COMPLETED' })
      .groupBy('oi.productId')
      .orderBy('"totalSold"', 'DESC');

    if (branchId && branchId !== 'undefined' && branchId !== 'null') {
      qb.andWhere('o.branchId = :branchId', { branchId });
    }

    const rows = await qb.getRawMany();
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.productId] = Number(row.totalSold) || 0;
    }
    return result;
  }

  // ==========================================
  // STOCKTAKES (KIỂM KHO)
  // ==========================================

  async findAllStocktakes(branchId?: string): Promise<Stocktake[]> {
    if (branchId === 'undefined' || branchId === 'null' || !branchId) {
      branchId = undefined;
    }
    const whereClause = branchId ? { branchId } : {};
    return this.stocktakeRepository.find({
      where: whereClause,
      relations: ['createdBy', 'approvedBy', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOneStocktake(id: string): Promise<Stocktake> {
    const stocktake = await this.stocktakeRepository.findOne({
      where: { id },
      relations: ['createdBy', 'approvedBy', 'items', 'items.product', 'items.product.unit'],
    });
    if (!stocktake) {
      throw new NotFoundException(`Stocktake ${id} not found`);
    }
    return stocktake;
  }

  async createStocktake(createDto: CreateStocktakeDto, userId: string): Promise<Stocktake> {
    // Generate a unique code
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.stocktakeRepository.count();
    const code = `STK-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

    const stocktake = this.stocktakeRepository.create({
      code,
      branchId: createDto.branchId,
      note: createDto.note,
      createdById: userId,
      status: StocktakeStatus.PENDING,
      items: createDto.items.map(item => this.stocktakeItemRepository.create({
        productId: item.productId,
        systemQuantity: item.systemQuantity,
        actualQuantity: item.actualQuantity,
        difference: item.difference,
        reason: item.reason,
      })),
    });

    return this.stocktakeRepository.save(stocktake);
  }

  async updateStocktake(id: string, updateDto: UpdateStocktakeDto): Promise<Stocktake> {
    const stocktake = await this.findOneStocktake(id);
    if (stocktake.status !== StocktakeStatus.PENDING) {
      throw new Error('Only PENDING stocktakes can be updated');
    }

    if (updateDto.note !== undefined) stocktake.note = updateDto.note;
    
    if (updateDto.items) {
      // Remove old items
      await this.stocktakeItemRepository.delete({ stocktakeId: id });
      
      // Add new items
      stocktake.items = updateDto.items.map(item => this.stocktakeItemRepository.create({
        productId: item.productId,
        systemQuantity: item.systemQuantity,
        actualQuantity: item.actualQuantity,
        difference: item.difference,
        reason: item.reason,
      }));
    }

    return this.stocktakeRepository.save(stocktake);
  }

  async approveStocktake(id: string, userId: string, action: 'COMPLETED' | 'CANCELLED'): Promise<Stocktake> {
    const stocktake = await this.findOneStocktake(id);
    
    if (stocktake.status !== StocktakeStatus.PENDING) {
      throw new Error(`Cannot change status. Current status is ${stocktake.status}`);
    }

    stocktake.status = action === 'COMPLETED' ? StocktakeStatus.COMPLETED : StocktakeStatus.CANCELLED;
    stocktake.approvedById = userId;

    await this.stocktakeRepository.save(stocktake);

    if (stocktake.status === StocktakeStatus.COMPLETED) {
      // Adjust inventory based on items difference
      for (const item of stocktake.items) {
        if (item.difference === 0) continue;

        if (item.difference < 0) {
          // Actual < System => We lost some items. Need to deduct.
          await this.deductStock(
            item.productId,
            stocktake.branchId,
            Math.abs(item.difference),
            stocktake.code,
            userId,
          );
        } else if (item.difference > 0) {
          // Actual > System => We have more items. Create an adjustment batch.
          const batch = this.inventoryRepository.create({
            productId: item.productId,
            branchId: stocktake.branchId,
            importedQuantity: item.difference,
            currentQuantity: item.difference,
            costPrice: 0, // Or avg cost if possible, but 0 is safe for adjustments
            personnelName: 'Hệ thống (Kiểm kho)',
            importDate: new Date(),
          });
          const savedBatch = await this.inventoryRepository.save(batch);

          // Log the adjustment
          const log = this.inventoryLogRepository.create({
            productId: item.productId,
            branchId: stocktake.branchId,
            type: StockMovementType.ADJUST,
            quantity: item.difference,
            batchId: savedBatch.id,
            referenceCode: stocktake.code,
            note: `Điều chỉnh tăng dư kho ${item.difference} sản phẩm`,
            createdById: userId,
          });
          await this.inventoryLogRepository.save(log);
        }
      }
    }

    return stocktake;
  }

  async exportStock(dto: ExportStockDto, userId: string): Promise<void> {
    const { branchId, productId, quantity, note } = dto;
    
    if (quantity <= 0) {
      throw new Error('Số lượng xuất kho phải lớn hơn 0');
    }

    const batches = await this.inventoryRepository.find({
      where: {
        productId,
        branchId,
        currentQuantity: MoreThan(0),
      },
      order: {
        expiryDate: 'ASC',
        createdAt: 'ASC',
      },
    });

    const totalAvailable = batches.reduce((sum, b) => sum + b.currentQuantity, 0);
    if (totalAvailable < quantity) {
      throw new Error(`Số lượng tồn kho không đủ để xuất (Tồn kho hiện tại: ${totalAvailable})`);
    }

    let remainingToDeduct = quantity;
    const refCode = 'EXP-' + new Date().getTime();

    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;

      const deductAmount = Math.min(batch.currentQuantity, remainingToDeduct);
      batch.currentQuantity -= deductAmount;
      remainingToDeduct -= deductAmount;

      await this.inventoryRepository.save(batch);

      const log = this.inventoryLogRepository.create({
        productId,
        branchId,
        type: StockMovementType.EXPORT,
        quantity: -deductAmount,
        batchId: batch.id,
        referenceCode: refCode,
        note: note || `Xuất kho ${deductAmount} sản phẩm`,
        createdById: userId,
      });
      await this.inventoryLogRepository.save(log);
    }
  }

  async transferStock(dto: CreateTransferDto, userId: string): Promise<InventoryTransfer> {
    const { fromBranchId, toBranchId, items, note } = dto;

    if (fromBranchId === toBranchId) {
      throw new Error('Chi nhánh nguồn và chi nhánh đích không thể trùng nhau');
    }

    if (!items || items.length === 0) {
      throw new Error('Danh sách sản phẩm chuyển kho không được để trống');
    }

    // Generate a unique code
    const code = 'TRSF-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);

    const transfer = this.transferRepository.create({
      code,
      fromBranchId,
      toBranchId,
      note,
      createdById: userId,
      status: TransferStatus.PENDING,
      items: [],
    });

    const savedTransfer = await this.transferRepository.save(transfer);
    const transferItems: InventoryTransferItem[] = [];

    for (const item of items) {
      const { productId, quantity } = item;
      if (quantity <= 0) {
        throw new Error('Số lượng chuyển kho phải lớn hơn 0');
      }

      // Get batches at source branch ordered by expiry date and creation date
      const batches = await this.inventoryRepository.find({
        where: {
          productId,
          branchId: fromBranchId,
          currentQuantity: MoreThan(0),
        },
        order: {
          expiryDate: 'ASC',
          createdAt: 'ASC',
        },
      });

      const totalAvailable = batches.reduce((sum, b) => sum + b.currentQuantity, 0);
      if (totalAvailable < quantity) {
        throw new Error(`Số lượng sản phẩm trong kho nguồn không đủ để thực hiện chuyển kho`);
      }

      let remainingToDeduct = quantity;
      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;

        const deductAmount = Math.min(batch.currentQuantity, remainingToDeduct);
        const originalCostPrice = batch.costPrice;

        // Deduct from source batch
        batch.currentQuantity -= deductAmount;
        remainingToDeduct -= deductAmount;
        await this.inventoryRepository.save(batch);

        // Log EXPORT at source branch
        const exportLog = this.inventoryLogRepository.create({
          productId,
          branchId: fromBranchId,
          type: StockMovementType.EXPORT,
          quantity: -deductAmount,
          batchId: batch.id,
          referenceCode: code,
          note: note || `Chuyển kho ${deductAmount} sản phẩm sang chi nhánh khác`,
          createdById: userId,
        });
        await this.inventoryLogRepository.save(exportLog);

        // Save transfer item detail
        const transferItem = this.transferItemRepository.create({
          transferId: savedTransfer.id,
          productId,
          quantity: deductAmount,
          costPrice: originalCostPrice,
          expiryDate: batch.expiryDate,
          invoiceName: batch.invoiceName,
        });
        transferItems.push(await this.transferItemRepository.save(transferItem));
      }
    }

    savedTransfer.items = transferItems;
    return savedTransfer;
  }

  async confirmTransfer(id: string, userId: string): Promise<InventoryTransfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id },
      relations: ['items', 'items.product'],
    });

    if (!transfer) {
      throw new NotFoundException(`Không tìm thấy phiếu chuyển kho với ID ${id}`);
    }

    if (transfer.status !== TransferStatus.PENDING) {
      throw new Error('Phiếu chuyển kho này không ở trạng thái chờ nhận');
    }

    transfer.status = TransferStatus.COMPLETED;
    transfer.confirmedById = userId;
    const updatedTransfer = await this.transferRepository.save(transfer);

    // Create batches and log imports at receiving branch
    for (const item of transfer.items) {
      const newBatch = this.inventoryRepository.create({
        productId: item.productId,
        branchId: transfer.toBranchId,
        importedQuantity: item.quantity,
        currentQuantity: item.quantity,
        costPrice: item.costPrice,
        personnelName: 'Hệ thống (Nhận chuyển kho)',
        importDate: new Date(),
        expiryDate: item.expiryDate,
        invoiceName: item.invoiceName,
      });
      const savedBatch = await this.inventoryRepository.save(newBatch);

      // Log IMPORT at receiving branch
      const importLog = this.inventoryLogRepository.create({
        productId: item.productId,
        branchId: transfer.toBranchId,
        type: StockMovementType.IMPORT,
        quantity: item.quantity,
        batchId: savedBatch.id,
        referenceCode: transfer.code,
        note: transfer.note || `Nhận chuyển kho ${item.quantity} sản phẩm`,
        createdById: userId,
      });
      await this.inventoryLogRepository.save(importLog);
    }

    return updatedTransfer;
  }

  async cancelTransfer(id: string, userId: string): Promise<InventoryTransfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!transfer) {
      throw new NotFoundException(`Không tìm thấy phiếu chuyển kho với ID ${id}`);
    }

    if (transfer.status !== TransferStatus.PENDING) {
      throw new Error('Phiếu chuyển kho này không ở trạng thái chờ nhận');
    }

    transfer.status = TransferStatus.CANCELLED;
    transfer.confirmedById = userId;
    const updatedTransfer = await this.transferRepository.save(transfer);

    // Restore stock back to source branch
    for (const item of transfer.items) {
      const newBatch = this.inventoryRepository.create({
        productId: item.productId,
        branchId: transfer.fromBranchId,
        importedQuantity: item.quantity,
        currentQuantity: item.quantity,
        costPrice: item.costPrice,
        personnelName: 'Hệ thống (Hoàn trả chuyển kho)',
        importDate: new Date(),
        expiryDate: item.expiryDate,
        invoiceName: item.invoiceName,
      });
      const savedBatch = await this.inventoryRepository.save(newBatch);

      // Log IMPORT at source branch (returning stock)
      const importLog = this.inventoryLogRepository.create({
        productId: item.productId,
        branchId: transfer.fromBranchId,
        type: StockMovementType.IMPORT,
        quantity: item.quantity,
        batchId: savedBatch.id,
        referenceCode: transfer.code,
        note: `Hủy nhận hàng - Hoàn trả ${item.quantity} sản phẩm`,
        createdById: userId,
      });
      await this.inventoryLogRepository.save(importLog);
    }

    return updatedTransfer;
  }

  async findAllTransfers(branchId?: string, status?: TransferStatus): Promise<InventoryTransfer[]> {
    const query = this.transferRepository.createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.fromBranch', 'fromBranch')
      .leftJoinAndSelect('transfer.toBranch', 'toBranch')
      .leftJoinAndSelect('transfer.createdBy', 'createdBy')
      .leftJoinAndSelect('transfer.confirmedBy', 'confirmedBy')
      .leftJoinAndSelect('transfer.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('product.unit', 'unit')
      .orderBy('transfer.createdAt', 'DESC');

    if (branchId && branchId !== 'undefined' && branchId !== 'null') {
      query.andWhere('(transfer.fromBranchId = :branchId OR transfer.toBranchId = :branchId)', { branchId });
    }

    if (status) {
      query.andWhere('transfer.status = :status', { status });
    }

    return query.getMany();
  }

  async findOneTransfer(id: string): Promise<InventoryTransfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id },
      relations: ['fromBranch', 'toBranch', 'createdBy', 'confirmedBy', 'items', 'items.product', 'items.product.unit'],
    });
    if (!transfer) {
      throw new NotFoundException(`Không tìm thấy phiếu chuyển kho với ID ${id}`);
    }
    return transfer;
  }

  // Import legacy inventory data from an Excel file buffer.
  async importLegacyFromExcel(buffer: Buffer, branchId: string, userId: string): Promise<{ imported: number; errors: any[]; errorFile?: string }> {
    if (!buffer) {
      throw new Error('File buffer is required');
    }
    if (!branchId) {
      throw new Error('branchId query parameter is required');
    }

    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const results = { imported: 0, errors: [] as any[] };

    for (const [index, row] of rows.entries()) {
      try {
        const parsed = parseLegacyImportRow(row);

        if (parsed.errors.length > 0) {
          results.errors.push({ row: index + 2, reason: parsed.errors.map((error) => `${error.field}: ${error.reason}`).join(' | ') });
          continue;
        }

        const productIdentifier = parsed.productIdentifier;
        const quantity = parsed.quantity;
        const costPrice = parsed.costPrice;
        const importDate = parsed.importDate;
        const invoiceName = parsed.invoiceName;
        const personnelName = parsed.personnelName;
        const distributorIdentifier = parsed.distributorIdentifier;
        const distributorCode = parsed.distributorCode;
        const distributorName = parsed.distributorName;
        const distributorPhone = parsed.distributorPhone;
        const distributorAddress = parsed.distributorAddress;
        const productName = parsed.productName;

        if (!productIdentifier || quantity === null || quantity <= 0) {
          results.errors.push({ row: index + 2, reason: 'Dữ liệu dòng không hợp lệ' });
          continue;
        }

        // Ensure distributor exists (create if missing). Try matching by code (in description), name or phone.
        let distributor: Distributor | null = null;
        if (distributorCode || distributorName || distributorIdentifier || distributorPhone) {
          const whereClauses: any[] = [];
          if (distributorCode) whereClauses.push({ code: distributorCode });
          if (distributorName) whereClauses.push({ name: distributorName });
          if (distributorIdentifier) whereClauses.push({ name: distributorIdentifier });
          if (distributorPhone) whereClauses.push({ phone: distributorPhone });

          distributor = (await this.distributorRepository.findOne({ where: whereClauses })) as unknown as Distributor | null;
          if (!distributor) {
            const createDto: Partial<Distributor> = {
              name: distributorName || distributorIdentifier || distributorCode || 'Nhà cung cấp mới',
              phone: distributorPhone || undefined,
              address: distributorAddress || undefined,
              code: distributorCode || undefined,
              description: distributorIdentifier || undefined,
            };
            const newDist = this.distributorRepository.create(createDto as any);
            distributor = (await this.distributorRepository.save(newDist)) as unknown as Distributor;
          }
        }

        const product = await this.productsRepository.findOne({
          where: [
            { productCode: productIdentifier },
            { barcode: productIdentifier },
            { name: productIdentifier },
          ],
        });

        // If product not found, create a minimal product record
        let finalProduct: Product | null = product ?? null;
        if (!finalProduct) {
          try {
            const createData: Partial<Product> = {
              name: productName || String(productIdentifier),
              productCode: productIdentifier,
              barcode: productIdentifier,
            };
            const newProduct = this.productsRepository.create(createData as any);
            finalProduct = await this.productsRepository.save(newProduct as any);
          } catch (createErr) {
            results.errors.push({ row: index + 2, product: productIdentifier, reason: 'Không tìm thấy sản phẩm và không thể tạo mới' });
            continue;
          }
        }

        const batch = this.inventoryRepository.create({
          productId: finalProduct!.id,
          branchId,
          importedQuantity: quantity,
          currentQuantity: quantity,
          costPrice,
          importDate,
          invoiceName,
          personnelName,
          distributorId: distributor ? distributor.id : undefined,
        });

        const saved = await this.inventoryRepository.save(batch);

        const log = this.inventoryLogRepository.create({
          productId: finalProduct!.id,
          branchId,
          type: StockMovementType.IMPORT,
          quantity: quantity,
          batchId: saved.id,
          referenceCode: 'LEGACY-' + Date.now(),
          note: `Import legacy row ${index + 2}`,
          createdById: userId,
        });
        await this.inventoryLogRepository.save(log);

        results.imported += 1;
      } catch (err) {
        results.errors.push({ row: index + 2, reason: err.message || err });
      }
    }

    // If there are errors, write them to an Excel file under uploads/legacy for later download
    if (results.errors.length > 0) {
      try {
        const errRows = results.errors.map((e) => ({
          row: e.row ?? e.rowNum ?? '',
          product: e.product ?? e.productIdentifier ?? '',
          reason: e.reason || e.message || JSON.stringify(e),
        }));

        const ws = xlsx.utils.json_to_sheet(errRows);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Errors');

        const uploadPath = path.resolve('uploads', 'legacy');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        const filename = `import_errors_${Date.now()}.xlsx`;
        const filePath = path.join(uploadPath, filename);

        // writeFile will create the file on disk
        xlsx.writeFile(wb, filePath);

        results['errorFile'] = filePath;
      } catch (writeErr) {
        // ignore file write errors but include an info entry
        results.errors.push({ row: null, reason: `Failed to write error file: ${writeErr.message || writeErr}` });
      }
    }

    return results;
  }

  // Read a saved file from disk and import its contents.
  async importLegacyFromFile(filePath: string, branchId: string, userId: string): Promise<{ imported: number; errors: any[] }> {
    if (!filePath) throw new Error('filePath is required');
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new NotFoundException(`File not found: ${resolved}`);
    }
    const buffer = await fs.promises.readFile(resolved);
    return this.importLegacyFromExcel(buffer, branchId, userId);
  }

  // ==========================================
  // IMPORT ORDERS (PHIếU NHậP KHO)
  // ==========================================

  async findAllImportOrders(branchId?: string, page = 1, limit = 10): Promise<PaginatedResult<InventoryImportOrder>> {
    if (branchId === 'undefined' || branchId === 'null' || !branchId) {
      branchId = undefined;
    }
    const whereClause = branchId ? { branchId } : {};
    const skip = (page - 1) * limit;

    const [data, total] = await this.importOrderRepository.findAndCount({
      where: whereClause,
      relations: ['distributor', 'createdBy', 'batches', 'batches.product', 'batches.product.unit'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOneImportOrder(id: string): Promise<InventoryImportOrder> {
    const order = await this.importOrderRepository.findOne({
      where: { id },
      relations: ['distributor', 'createdBy', 'batches', 'batches.product', 'batches.product.unit', 'batches.product.category'],
    });
    if (!order) {
      throw new NotFoundException(`Phểu nhập kho với ID ${id} không tồn tại`);
    }
    return order;
  }

  async createImportOrder(dto: CreateImportOrderDto, userId: string): Promise<InventoryImportOrder> {
    // Generate unique code: NK-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.importOrderRepository.count();
    const code = `NK-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

    // Create the order header
    const order = this.importOrderRepository.create({
      code,
      branchId: dto.branchId,
      distributorId: dto.distributorId || undefined,
      invoiceName: dto.invoiceName,
      personnelName: dto.personnelName,
      importDate: dto.importDate ? new Date(dto.importDate) : new Date(),
      note: dto.note,
      taxAmount: dto.taxAmount || 0,
      discountAmount: dto.discountAmount || 0,
      shippingFee: dto.shippingFee || 0,
      totalAmount: dto.totalAmount || 0,
      createdById: userId,
    });
    const savedOrder = await this.importOrderRepository.save(order);

    // Create batches for each item, linked to this order
    for (const item of dto.items) {
      const batch = this.inventoryRepository.create({
        productId: item.productId,
        branchId: dto.branchId,
        distributorId: dto.distributorId || undefined,
        importedQuantity: item.importedQuantity,
        currentQuantity: item.importedQuantity,
        costPrice: item.costPrice || 0,
        importDate: dto.importDate ? new Date(dto.importDate) : new Date(),
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
        invoiceName: dto.invoiceName,
        personnelName: dto.personnelName,
        isGift: item.isGift || false,
        importOrderId: savedOrder.id,
      });
      const savedBatch = await this.inventoryRepository.save(batch);

      // Update product basePrice
      if (item.costPrice && item.costPrice > 0) {
        await this.productsRepository.update(item.productId, { basePrice: item.costPrice });
      }

      // Log the import
      const log = this.inventoryLogRepository.create({
        productId: item.productId,
        branchId: dto.branchId,
        type: StockMovementType.IMPORT,
        quantity: item.importedQuantity,
        batchId: savedBatch.id,
        referenceCode: code,
        note: `Nhập kho theo phiểu ${code}`,
        createdById: userId,
      });
      await this.inventoryLogRepository.save(log);
    }

    return this.findOneImportOrder(savedOrder.id);
  }

  async updateImportOrder(id: string, dto: UpdateImportOrderDto): Promise<InventoryImportOrder> {
    const order = await this.importOrderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Phểu nhập kho với ID ${id} không tồn tại`);
    }
    await this.importOrderRepository.update(id, {
      ...dto,
      importDate: dto.importDate ? new Date(dto.importDate) : undefined,
    });
    return this.findOneImportOrder(id);
  }

  async deleteImportOrder(id: string): Promise<void> {
    const order = await this.importOrderRepository.findOne({
      where: { id },
      relations: ['batches'],
    });
    if (!order) {
      throw new NotFoundException(`Phểu nhập kho với ID ${id} không tồn tại`);
    }
    // Set NULL importOrderId on batches before removing order
    if (order.batches?.length) {
      await this.inventoryRepository.update(
        order.batches.map(b => b.id),
        { importOrderId: null },
      );
    }
    await this.importOrderRepository.remove(order);
  }
}

