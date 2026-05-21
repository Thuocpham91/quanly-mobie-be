import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { Customer } from '../customers/entities/customer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Customer]), InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
