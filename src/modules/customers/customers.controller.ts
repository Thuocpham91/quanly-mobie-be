import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Headers, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, BulkCreateCustomersDto } from './dto/customer.dto';
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

  @Post('bulk')
  bulkCreate(@Body() body: BulkCreateCustomersDto, @Headers('x-branch-id') headerBranchId?: string) {
    const list = body.customers.map(c => {
      if (!c.branchId && headerBranchId) {
        c.branchId = headerBranchId;
      }
      return c;
    });
    return this.customersService.bulkCreate(list);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importCustomers(
    @UploadedFile() file: any,
    @Headers('x-branch-id') headerBranchId?: string
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng tải lên tệp tin Excel');
    }
    return this.customersService.importExcel(file.buffer, headerBranchId);
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
