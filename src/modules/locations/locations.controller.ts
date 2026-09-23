import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('provinces')
  getProvinces(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.locationsService.getProvinces(this.parsePage(page), this.parseLimit(limit));
  }

  @Get('provinces/:id/districts')
  getDistricts(@Param('id', ParseIntPipe) id: number, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.locationsService.getDistricts(id, this.parsePage(page), this.parseLimit(limit));
  }

  @Get('districts/:id/wards')
  getWards(@Param('id', ParseIntPipe) id: number, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.locationsService.getWards(id, this.parsePage(page), this.parseLimit(limit));
  }

  private parsePage(value?: string): number {
    return parseInt(value || '1', 10) || 1;
  }

  private parseLimit(value?: string): number {
    return parseInt(value || '10', 10) || 10;
  }
}
