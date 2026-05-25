import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Headers } from '@nestjs/common';
import { PetsService } from './pets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePetDto, UpdatePetDto } from './dto/pet.dto';

@Controller('pets')
@UseGuards(JwtAuthGuard)
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Post()
  create(@Body() createPetDto: CreatePetDto, @Headers('x-branch-id') headerBranchId?: string) {
    if (!createPetDto.branchId && headerBranchId) {
      createPetDto.branchId = headerBranchId;
    }
    return this.petsService.create(createPetDto);
  }

  @Get()
  findAll(
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    return this.petsService.findAll(branchId, pageNum, limitNum);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.petsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePetDto: UpdatePetDto, @Headers('x-branch-id') headerBranchId?: string) {
    if (!updatePetDto.branchId && headerBranchId) {
      updatePetDto.branchId = headerBranchId;
    }
    return this.petsService.update(id, updatePetDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.petsService.remove(id);
  }

  @Get('owner/:ownerId')
  findByOwner(@Param('ownerId') ownerId: string) {
    return this.petsService.findByOwner(ownerId);
  }
}
