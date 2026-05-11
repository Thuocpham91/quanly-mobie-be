import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
  ) {}

  findAll(): Promise<Customer[]> {
    return this.customersRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  create(customerData: Partial<Customer>): Promise<Customer> {
    const customer = this.customersRepository.create(customerData);
    return this.customersRepository.save(customer);
  }

  async update(id: string, customerData: Partial<Customer>): Promise<Customer> {
    await this.findOne(id);
    await this.customersRepository.update(id, customerData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    await this.customersRepository.remove(customer);
  }

  async search(query: string): Promise<Customer[]> {
    return this.customersRepository
      .createQueryBuilder('customer')
      .where('customer.fullName ILIKE :query OR customer.phone ILIKE :query', { query: `%${query}%` })
      .getMany();
  }
}
