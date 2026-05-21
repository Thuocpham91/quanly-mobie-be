import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './entities/user.entity';
import { Branch } from '../branches/entities/branch.entity';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { MailService } from '../mail/services/mail.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Branch)
    private branchesRepository: Repository<Branch>,
    private mailService: MailService,
  ) {}

  async findOneByEmail(email: string): Promise<User | undefined> {
    const user = await this.usersRepository.findOne({ where: { email } });
    return user || undefined;
  }

  async findOneById(id: string): Promise<User | undefined> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: [
        'userBranchRoles',
        'userBranchRoles.branch',
        'userBranchRoles.role',
      ],
    });
    return user || undefined;
  }

  async findAll(
    branchId?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResult<User>> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userBranchRoles', 'ubr')
      .leftJoinAndSelect('ubr.branch', 'branch')
      .leftJoinAndSelect('ubr.role', 'role')
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (branchId) {
      queryBuilder.andWhere('branch.id = :branchId', { branchId });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(userData: Partial<User>): Promise<User> {
    let rawPassword = userData.password;
    if (!rawPassword) {
      // Generate a random 8-character password
      rawPassword = Math.random().toString(36).slice(-8);
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const { branchRoleAssignments, ...rest } = userData as any;
    const user = new User();
    Object.assign(user, rest);
    user.password = hashedPassword;

    const savedUser = await this.usersRepository.save(user);

    // TODO: Handle branchRoleAssignments if provided
    // This will be implemented in a separate endpoint or method

    // Send the password via email
    if (userData.email) {
      try {
        await this.mailService.sendAdminCredentials(userData.email, {
          email: userData.email,
          password: rawPassword,
        });
      } catch (error) {
        console.error('Failed to send credentials email:', error);
      }
    }

    return savedUser;
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    const user = await this.findOneById(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    const { branchRoleAssignments, ...rest } = userData as any;
    Object.assign(user, rest);

    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOneById(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    await this.usersRepository.remove(user);
  }
}
