import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { InventoryLog } from '../inventory/entities/inventory-log.entity';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Product } from '../products/entities/product.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order, OrderItem, InventoryLog, InventoryBatch, Customer, 
      Appointment, Product
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
