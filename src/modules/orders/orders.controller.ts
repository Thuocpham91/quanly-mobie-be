import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Put,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { OrderStatus } from './entities/order.entity';
import { UserBranchRole } from '../branches/entities/user-branch-role.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    @InjectRepository(UserBranchRole)
    private readonly ubrRepo: Repository<UserBranchRole>,
  ) {}

  @Post()
  @Permissions('sales.create')
  create(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    const branchId = req.headers['x-branch-id'];
    const userId = req.user.userId;
    return this.ordersService.create(createOrderDto, branchId, userId);
  }

  @Get()
  @Permissions('history.view')
  async findAll(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const branchId = req.headers['x-branch-id'];
    const userId = req.user.userId || req.user.id || req.user.sub;

    // Kiểm tra xem user có quyền xem tất cả không
    const ubr = await this.ubrRepo.findOne({
      where: { userId, branchId: branchId || undefined },
      relations: ['role', 'role.permissions'],
      order: { createdAt: 'ASC' },
    });
    const userPerms = ubr?.role?.permissions?.map((p: any) => p.name) || [];
    const isAdmin =
      req.user.email?.toLowerCase() === 'admin@gmail.com' ||
      ubr?.role?.name === 'Admin';
    const viewAll = isAdmin || userPerms.includes('history.view_others');

    return this.ordersService.findAll(
      branchId,
      page,
      limit,
      customerId,
      viewAll ? undefined : userId,
      status,
      search,
    );
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

  @Put(':id/date')
  updateDate(
    @Request() req,
    @Param('id') id: string,
    @Body('createdAt') createdAt: string,
  ) {
    const branchId = req.headers['x-branch-id'];
    return this.ordersService.updateOrderDate(id, branchId, createdAt);
  }

  @Post('import')
  @Permissions('sales.create')
  @UseInterceptors(FileInterceptor('file'))
  importOrders(@UploadedFile() file: any, @Request() req) {
    const branchId = req.headers['x-branch-id'];
    return this.ordersService.importOrdersFromExcel(
      file?.buffer,
      branchId,
      req.user.userId,
    );
  }

  @Post('import-details')
  @Permissions('sales.create')
  @UseInterceptors(FileInterceptor('file'))
  importOrderDetails(@UploadedFile() file: any, @Request() req) {
    const branchId = req.headers['x-branch-id'];
    // optional query params for createMissingOrders and skipStockDeduction
    return this.ordersService.importOrderDetailsFromExcel(
      file?.buffer,
      branchId,
      req.user.userId,
      {
        createMissingOrders: req.query.createMissingOrders !== 'false',
        skipStockDeduction: req.query.skipStockDeduction !== 'false',
      },
    );
  }
}
