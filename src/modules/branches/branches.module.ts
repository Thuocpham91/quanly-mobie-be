import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { Branch } from './entities/branch.entity';

import { UserBranchRole } from './entities/user-branch-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, UserBranchRole])],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService, TypeOrmModule],
})
export class BranchesModule {}
