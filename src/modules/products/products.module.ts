import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { ProductUnit } from './entities/product-unit.entity';
import { Classification } from './entities/classification.entity';
import { Unit } from './entities/unit.entity';
import { ClassificationsService } from './classifications.service';
import { ClassificationsController } from './classifications.controller';
import { UnitsService } from './units.service';
import { UnitsController } from './units.controller';
import { AuthModule } from '../auth/auth.module';
import { BranchesModule } from '../branches/branches.module';
import { ProductBranchPrice } from './entities/product-branch-price.entity';
import { ProductPricesController } from './product-prices.controller';
import { ProductPricesService } from './product-prices.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductUnit, Classification, Unit, ProductBranchPrice]),
    forwardRef(() => AuthModule),
    BranchesModule,
  ],
  controllers: [ProductsController, ClassificationsController, UnitsController, ProductPricesController],
  providers: [ProductsService, ClassificationsService, UnitsService, ProductPricesService],
  exports: [ProductsService, ClassificationsService, UnitsService, ProductPricesService],
})
export class ProductsModule {}
