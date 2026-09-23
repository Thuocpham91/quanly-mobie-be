import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ClassificationsService } from './classifications.service';
import { CreateClassificationDto, UpdateClassificationDto } from './dto/classification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('classifications')
@UseGuards(JwtAuthGuard)
export class ClassificationsController {
  constructor(private readonly classificationsService: ClassificationsService) {}

  @Post()
  create(@Body() createClassificationDto: CreateClassificationDto) {
    return this.classificationsService.create(createClassificationDto);
  }

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = parseInt(page || '1', 10) || 1;
    const limitNum = parseInt(limit || '10', 10) || 10;
    return this.classificationsService.findAll(pageNum, limitNum);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classificationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClassificationDto: UpdateClassificationDto) {
    return this.classificationsService.update(id, updateClassificationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.classificationsService.remove(id);
  }
}
