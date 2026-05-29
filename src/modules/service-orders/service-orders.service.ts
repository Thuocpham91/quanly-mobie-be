import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceOrder, ServiceOrderStatus } from './entities/service-order.entity';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';

@Injectable()
export class ServiceOrdersService {
  constructor(
    @InjectRepository(ServiceOrder)
    private readonly serviceOrdersRepository: Repository<ServiceOrder>,
  ) {}

  private generateRandomCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async generateUniqueOrderCode(): Promise<string> {
    let orderCode = this.generateRandomCode();
    let exists = await this.serviceOrdersRepository.findOne({ where: { orderCode } });
    let attempts = 0;
    while (exists && attempts < 10) {
      orderCode = this.generateRandomCode();
      exists = await this.serviceOrdersRepository.findOne({ where: { orderCode } });
      attempts++;
    }
    return orderCode;
  }

  async create(createDto: CreateServiceOrderDto, branchId: string): Promise<ServiceOrder> {
    if (!branchId) {
      throw new BadRequestException('Branch ID is required.');
    }

    const orderCode = await this.generateUniqueOrderCode();
    const serviceOrder = this.serviceOrdersRepository.create({
      ...createDto,
      orderCode,
      branchId,
      appointmentDate: createDto.appointmentDate ? new Date(createDto.appointmentDate) : undefined,
      deadline: createDto.deadline ? new Date(createDto.deadline) : undefined,
    });

    return this.serviceOrdersRepository.save(serviceOrder);
  }

  async findAll(
    branchId: string,
    page = 1,
    limit = 10,
    status?: string,
    search?: string,
  ): Promise<{ data: ServiceOrder[]; total: number }> {
    const query = this.serviceOrdersRepository
      .createQueryBuilder('so')
      .leftJoinAndSelect('so.customer', 'customer')
      .orderBy('so.createdAt', 'DESC');

    if (branchId && branchId !== 'undefined' && branchId !== 'null') {
      query.andWhere('so.branchId = :branchId', { branchId });
    }

    if (status && status !== 'ALL') {
      query.andWhere('so.status = :status', { status });
    }

    if (search) {
      const formattedSearch = `%${search.toLowerCase().trim()}%`;
      query.andWhere(
        '(LOWER(so.orderCode) LIKE :search OR LOWER(so.address) LIKE :search OR LOWER(customer.fullName) LIKE :search OR customer.phone LIKE :search OR LOWER(so.jobDescription) LIKE :search)',
        { search: formattedSearch },
      );
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string, branchId?: string): Promise<ServiceOrder> {
    const where: any = { id };
    if (branchId && branchId !== 'undefined' && branchId !== 'null') {
      where.branchId = branchId;
    }

    const order = await this.serviceOrdersRepository.findOne({
      where,
      relations: ['customer'],
    });

    if (!order) {
      throw new NotFoundException(`Service order with ID ${id} not found.`);
    }

    return order;
  }

  async update(id: string, updateDto: UpdateServiceOrderDto, branchId?: string): Promise<ServiceOrder> {
    const order = await this.findOne(id, branchId);

    const updated = Object.assign(order, {
      ...updateDto,
      appointmentDate: updateDto.appointmentDate ? new Date(updateDto.appointmentDate) : order.appointmentDate,
      deadline: updateDto.deadline ? new Date(updateDto.deadline) : order.deadline,
    });

    return this.serviceOrdersRepository.save(updated);
  }

  async remove(id: string, branchId?: string): Promise<void> {
    const order = await this.findOne(id, branchId);
    await this.serviceOrdersRepository.remove(order);
  }
}
