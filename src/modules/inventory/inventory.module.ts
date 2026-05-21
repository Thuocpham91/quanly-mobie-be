import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryBatch } from './entities/inventory-batch.entity';
import { InventoryLog } from './entities/inventory-log.entity';
import { Stocktake } from './entities/stocktake.entity';
import { StocktakeItem } from './entities/stocktake-item.entity';
import { InventoryTransfer } from './entities/inventory-transfer.entity';
import { InventoryTransferItem } from './entities/inventory-transfer-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductUnit } from '../products/entities/product-unit.entity';
import { OrderItem } from '../orders/entities/order-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    InventoryBatch,
    InventoryLog,
    Stocktake,
    StocktakeItem,
    InventoryTransfer,
    InventoryTransferItem,
    Product,
    ProductUnit,
    OrderItem
  ])],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
