import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { Province, District, Ward } from './entities/location.entity';
import { LocationsSeedService } from './locations-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Province, District, Ward])],
  controllers: [LocationsController],
  providers: [LocationsService, LocationsSeedService],
  exports: [LocationsService],
})
export class LocationsModule {}
