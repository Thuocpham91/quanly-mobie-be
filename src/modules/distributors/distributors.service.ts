import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async findAll(page = 1, limit = 10): Promise<PaginatedResult<Distributor>> {
    const pageNumber = Math.max(1, page);
    const [data, total] = await this.distributorRepository.findAndCount({
      order: { name: 'ASC' },
      skip: (pageNumber - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { total, page: pageNumber, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
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
