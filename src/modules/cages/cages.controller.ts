import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { CagesService } from './cages.service';
import { CreateCageDto, UpdateCageDto } from './dto/cage.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cages')
@UseGuards(JwtAuthGuard)
export class CagesController {
  constructor(private readonly cagesService: CagesService) {}

  @Post()
  create(@Body() createCageDto: CreateCageDto) {
    return this.cagesService.create(createCageDto);
  }

  @Get()
  findAll(@Query('roomId') roomId?: string) {
    return this.cagesService.findAll(roomId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cagesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCageDto: UpdateCageDto) {
    return this.cagesService.update(id, updateCageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cagesService.remove(id);
  }
}
