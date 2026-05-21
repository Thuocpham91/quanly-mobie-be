import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistributorsService } from './distributors.service';
import { DistributorsController } from './distributors.controller';
import { Distributor } from './entities/distributor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Distributor])],
  controllers: [DistributorsController],
  providers: [DistributorsService],
  exports: [DistributorsService],
})
export class DistributorsModule {}
