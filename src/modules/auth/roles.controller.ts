import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { Permissions } from './permissions.decorator';

import { CreateRoleDto, UpdateRoleDto } from './dto/roles.dto';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = parseInt(page || '1', 10) || 1;
    const limitNum = parseInt(limit || '10', 10) || 10;
    return this.rolesService.findAll(pageNum, limitNum);
  }

  @Get('permissions')
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateRoleDto) {
    return this.rolesService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateRoleDto) {
    return this.rolesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
