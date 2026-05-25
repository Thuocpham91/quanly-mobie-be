import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Headers } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsNumber } from 'class-validator';

class WalletTopUpDto {
  @IsNumber()
  amount: number;
}

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@Body() createCustomerDto: CreateCustomerDto, @Headers('x-branch-id') headerBranchId?: string) {
    if (!createCustomerDto.branchId && headerBranchId) {
      createCustomerDto.branchId = headerBranchId;
    }
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  findAll(
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    return this.customersService.findAll(branchId, pageNum, limitNum);
  }


  @Get('search')
  search(
    @Query('q') q: string, 
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    return this.customersService.search(q, branchId, pageNum, limitNum);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto, @Headers('x-branch-id') headerBranchId?: string) {
    if (!updateCustomerDto.branchId && headerBranchId) {
      updateCustomerDto.branchId = headerBranchId;
    }
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Patch(':id/wallet')
  topUpWallet(
    @Param('id') id: string,
    @Body() body: WalletTopUpDto,
  ) {
    return this.customersService.topUpWallet(id, Number(body.amount));
  }
}
