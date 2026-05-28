import { Controller, Get, Post, Body, Param, Query, Patch, Delete, UseGuards, Request } from '@nestjs/common';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Post()
  @Permissions('sales.create')
  create(@Request() req, @Body() createDto: CreateServiceOrderDto) {
    const branchId = req.headers['x-branch-id'];
    return this.serviceOrdersService.create(createDto, branchId);
  }

  @Get()
  @Permissions('history.view')
  findAll(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const branchId = req.headers['x-branch-id'];
    return this.serviceOrdersService.findAll(branchId, Number(page), Number(limit), status, search);
  }

  @Get(':id')
  @Permissions('history.view')
  findOne(@Request() req, @Param('id') id: string) {
    const branchId = req.headers['x-branch-id'];
    return this.serviceOrdersService.findOne(id, branchId);
  }

  @Patch(':id')
  @Permissions('sales.create')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateServiceOrderDto,
  ) {
    const branchId = req.headers['x-branch-id'];
    return this.serviceOrdersService.update(id, updateDto, branchId);
  }

  @Delete(':id')
  @Permissions('sales.create')
  remove(@Request() req, @Param('id') id: string) {
    const branchId = req.headers['x-branch-id'];
    return this.serviceOrdersService.remove(id, branchId);
  }
}
