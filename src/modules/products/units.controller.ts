import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UnitsService } from './units.service';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('units')
@UseGuards(JwtAuthGuard)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  create(@Body() createUnitDto: CreateUnitDto) {
    return this.unitsService.create(createUnitDto);
  }

  @Get()
  findAll() {
    return this.unitsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.unitsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUnitDto: UpdateUnitDto) {
    return this.unitsService.update(id, updateUnitDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.unitsService.remove(id);
  }
}
