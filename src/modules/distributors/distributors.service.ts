import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Distributor } from './entities/distributor.entity';
import { CreateDistributorDto, UpdateDistributorDto } from './dto/distributor.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

@Injectable()
export class DistributorsService {
  constructor(
    @InjectRepository(Distributor)
    private distributorRepository: Repository<Distributor>,
  ) {}

  create(createDistributorDto: CreateDistributorDto) {
    const distributor = this.distributorRepository.create(createDistributorDto);
    return this.distributorRepository.save(distributor);
  }

  async findAll(page = 1, limit = 10, search?: string, address?: string): Promise<PaginatedResult<Distributor>> {
    const pageNumber = Math.max(1, page);
    const limitNumber = Math.max(1, limit);
    const searchTerm = search?.trim();
    const addressTerm = address?.trim();
    const where = searchTerm
      ? [
          { name: ILike(`%${searchTerm}%`), ...(addressTerm ? { address: ILike(`%${addressTerm}%`) } : {}) },
          { code: ILike(`%${searchTerm}%`), ...(addressTerm ? { address: ILike(`%${addressTerm}%`) } : {}) },
          { phone: ILike(`%${searchTerm}%`), ...(addressTerm ? { address: ILike(`%${addressTerm}%`) } : {}) },
          { email: ILike(`%${searchTerm}%`), ...(addressTerm ? { address: ILike(`%${addressTerm}%`) } : {}) },
        ]
      : addressTerm
        ? { address: ILike(`%${addressTerm}%`) }
        : undefined;
    const [data, total] = await this.distributorRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (pageNumber - 1) * limitNumber,
      take: limitNumber,
    });

    return {
      data,
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.max(1, Math.ceil(total / limitNumber)),
      },
    };
  }

  async findOne(id: string) {
    const distributor = await this.distributorRepository.findOne({ where: { id } });
    if (!distributor) {
      throw new NotFoundException(`Distributor with ID ${id} not found`);
    }
    return distributor;
  }

  async update(id: string, updateDistributorDto: UpdateDistributorDto) {
    const distributor = await this.findOne(id);
    Object.assign(distributor, updateDistributorDto);
    return this.distributorRepository.save(distributor);
  }

  async remove(id: string) {
    const distributor = await this.findOne(id);
    await this.distributorRepository.remove(distributor);
  }
}
