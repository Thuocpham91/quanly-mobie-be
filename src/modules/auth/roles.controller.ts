import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { Permissions } from './permissions.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
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
  create(@Body() data: { name: string; description?: string; permissionIds: string[] }) {
    return this.rolesService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: { name?: string; description?: string; permissionIds?: string[] }) {
    return this.rolesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
