import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('branches')
@UseGuards(JwtAuthGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  create(@Body() createBranchDto: CreateBranchDto) {
    return this.branchesService.create(createBranchDto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    return this.branchesService.findAll(pageNum, limitNum);
  }


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBranchDto: UpdateBranchDto) {
    return this.branchesService.update(id, updateBranchDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.branchesService.remove(id);
  }

  @Post(':id/users/:userId/role')
  assignRole(
    @Param('id') branchId: string,
    @Param('userId') userId: string,
    @Body('roleId') roleId: string,
  ) {
    return this.branchesService.assignUserRole(userId, branchId, roleId);
  }

  @Delete(':id/users/:userId')
  removeUser(
    @Param('id') branchId: string,
    @Param('userId') userId: string,
  ) {
    return this.branchesService.removeUserFromBranch(userId, branchId);
  }
}
