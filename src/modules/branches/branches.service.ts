import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { UserBranchRole } from './entities/user-branch-role.entity';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private branchesRepository: Repository<Branch>,
    @InjectRepository(UserBranchRole)
    private userBranchRoleRepository: Repository<UserBranchRole>,
  ) {}

  async assignUserRole(userId: string, branchId: string, roleId: string) {
    let assignment = await this.userBranchRoleRepository.findOne({
      where: { userId, branchId },
    });

    if (assignment) {
      assignment.roleId = roleId;
    } else {
      assignment = this.userBranchRoleRepository.create({
        userId,
        branchId,
        roleId,
      });
    }

    return await this.userBranchRoleRepository.save(assignment);
  }

  async removeUserFromBranch(userId: string, branchId: string) {
    const assignment = await this.userBranchRoleRepository.findOne({
      where: { userId, branchId },
    });
    if (assignment) {
      await this.userBranchRoleRepository.remove(assignment);
    }
  }

  async create(createBranchDto: CreateBranchDto): Promise<Branch> {
    const branch = this.branchesRepository.create(createBranchDto);
    return await this.branchesRepository.save(branch);
  }

  async findAll(page: number = 1, limit: number = 10): Promise<PaginatedResult<Branch>> {
    const skip = (page - 1) * limit;
    
    const [data, total] = await this.branchesRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOne(id: string): Promise<Branch> {
    const branch = await this.branchesRepository.findOneBy({ id });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }
    return branch;
  }

  async update(id: string, updateBranchDto: UpdateBranchDto): Promise<Branch> {
    const branch = await this.findOne(id);
    Object.assign(branch, updateBranchDto);
    return await this.branchesRepository.save(branch);
  }

  async remove(id: string): Promise<void> {
    const branch = await this.findOne(id);
    await this.branchesRepository.remove(branch);
  }
}
