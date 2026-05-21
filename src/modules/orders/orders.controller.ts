import { Controller, Get, Post, Body, Param, Query, Put, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderStatus } from './entities/order.entity';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    const branchId = req.headers['x-branch-id'];
    const userId = req.user.userId;
    return this.ordersService.create(createOrderDto, branchId, userId);
  }

  @Get()
  findAll(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('petId') petId?: string,
    @Query('customerId') customerId?: string,
  ) {
    const branchId = req.headers['x-branch-id'];
    return this.ordersService.findAll(branchId, page, limit, petId, customerId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    const branchId = req.headers['x-branch-id'];
    return this.ordersService.findOne(id, branchId);
  }

  @Put(':id/status')
  updateStatus(
    @Request() req,
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
  ) {
    const branchId = req.headers['x-branch-id'];
    const userId = req.user.userId;
    return this.ordersService.updateStatus(id, branchId, status, userId);
  }
}
