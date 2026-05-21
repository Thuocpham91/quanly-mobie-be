import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('provinces')
  getProvinces() {
    return this.locationsService.getProvinces();
  }

  @Get('provinces/:id/districts')
  getDistricts(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.getDistricts(id);
  }

  @Get('districts/:id/wards')
  getWards(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.getWards(id);
  }
}
