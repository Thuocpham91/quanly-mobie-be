import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ItemGroupsService } from './item-groups.service';
import { CreateItemGroupDto, UpdateItemGroupDto } from './dto/item-group.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('item-groups')
@UseGuards(JwtAuthGuard)
export class ItemGroupsController {
  constructor(private readonly itemGroupsService: ItemGroupsService) {}

  @Post()
  create(@Body() createItemGroupDto: CreateItemGroupDto) {
    return this.itemGroupsService.create(createItemGroupDto);
  }

  @Get()
  findAll() {
    return this.itemGroupsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.itemGroupsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateItemGroupDto: UpdateItemGroupDto) {
    return this.itemGroupsService.update(id, updateItemGroupDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.itemGroupsService.remove(id);
  }
}
