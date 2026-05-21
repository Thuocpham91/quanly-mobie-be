import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemGroupsService } from './item-groups.service';
import { ItemGroupsController } from './item-groups.controller';
import { ItemGroup } from './entities/item-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ItemGroup])],
  controllers: [ItemGroupsController],
  providers: [ItemGroupsService],
  exports: [ItemGroupsService],
})
export class ItemGroupsModule {}
