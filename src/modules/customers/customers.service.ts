import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { UsersService } from '../users/users.service';


@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
    private usersService: UsersService,
  ) {}

  async findAll(branchId?: string, page: number = 1, limit: number = 10): Promise<PaginatedResult<Customer>> {
    const whereClause = branchId ? { branchId } : {};
    const skip = (page - 1) * limit;
    
    const [data, total] = await this.customersRepository.findAndCount({ 
      where: whereClause, 
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

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async create(customerData: Partial<Customer>): Promise<Customer> {
    if (customerData.phone) {
      const existing = await this.customersRepository.findOne({
        where: { phone: customerData.phone },
      });
      if (existing) {
        throw new BadRequestException('Số điện thoại khách hàng đã tồn tại trong hệ thống');
      }
    }

    const customer = this.customersRepository.create(customerData);
    const savedCustomer = await this.customersRepository.save(customer);

    try {
      // Tự động tạo tài khoản cho khách hàng
      const userEmail = savedCustomer.email || `${savedCustomer.phone}@noemail.local`;
      await this.usersService.create({
        fullName: savedCustomer.fullName,
        email: userEmail,
        phone: savedCustomer.phone,
        isActive: true,
      });
    } catch (error) {
      console.error('Failed to auto-create user for customer:', error);
    }

    return savedCustomer;
  }

  async update(id: string, customerData: Partial<Customer>): Promise<Customer> {
    await this.findOne(id);
    if (customerData.phone) {
      const existing = await this.customersRepository.findOne({
        where: { phone: customerData.phone },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Số điện thoại khách hàng đã tồn tại trong hệ thống');
      }
    }
    await this.customersRepository.update(id, customerData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    await this.customersRepository.remove(customer);
  }

  async search(query: string, branchId?: string, page: number = 1, limit: number = 10): Promise<PaginatedResult<Customer>> {
    const skip = (page - 1) * limit;
    const queryBuilder = this.customersRepository.createQueryBuilder('customer')
      .where('(customer.fullName ILIKE :query OR customer.phone ILIKE :query)', { query: `%${query}%` });
      
    if (branchId) {
      queryBuilder.andWhere('customer.branchId = :branchId', { branchId });
    }
    
    const [data, total] = await queryBuilder
      .orderBy('customer.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
      
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

  async topUpWallet(id: string, amount: number): Promise<Customer> {
    const customer = await this.findOne(id);
    const currentBalance = Number(customer.walletBalance) || 0;
    const newBalance = currentBalance + amount;
    if (newBalance < 0) {
      throw new Error('Số dư ví không đủ');
    }
    await this.customersRepository.update(id, { walletBalance: newBalance });
    return this.findOne(id);
  }
}
