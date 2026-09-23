import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Classification } from './entities/classification.entity';
import { CreateClassificationDto, UpdateClassificationDto } from './dto/classification.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

@Injectable()
export class ClassificationsService {
  constructor(
    @InjectRepository(Classification)
    private classificationsRepository: Repository<Classification>,
  ) {}

  async findAll(page = 1, limit = 10): Promise<PaginatedResult<Classification>> {
    const pageNumber = Math.max(1, page);
    const [data, total] = await this.classificationsRepository.findAndCount({
      order: { name: 'ASC' },
      skip: (pageNumber - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { total, page: pageNumber, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findOne(id: string): Promise<Classification> {
    const classification = await this.classificationsRepository.findOne({ where: { id } });
    if (!classification) {
      throw new NotFoundException(`Classification with ID ${id} not found`);
    }
    return classification;
  }

  async create(createClassificationDto: CreateClassificationDto): Promise<Classification> {
    const classification = this.classificationsRepository.create(createClassificationDto);
    return this.classificationsRepository.save(classification);
  }

  async update(id: string, updateClassificationDto: UpdateClassificationDto): Promise<Classification> {
    await this.findOne(id);
    await this.classificationsRepository.update(id, updateClassificationDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const classification = await this.findOne(id);
    await this.classificationsRepository.remove(classification);
  }
}
