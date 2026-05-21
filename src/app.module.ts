import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BranchesModule } from './modules/branches/branches.module';
import { LocationsModule } from './modules/locations/locations.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PetsModule } from './modules/pets/pets.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { CagesModule } from './modules/cages/cages.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ItemGroupsModule } from './modules/item-groups/item-groups.module';
import { DistributorsModule } from './modules/distributors/distributors.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { FileModule } from './modules/file/file.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true, // Only for development
      }),
    }),
    AuthModule,
    UsersModule,
    BranchesModule,
    LocationsModule,
    CustomersModule,
    PetsModule,
    RoomsModule,
    CagesModule,
    ProductsModule,
    InventoryModule,
    CategoriesModule,
    ItemGroupsModule,
    DistributorsModule,
    NotificationsModule,
    OrdersModule,
    FileModule,
    AppointmentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
