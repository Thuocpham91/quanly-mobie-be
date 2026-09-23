import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Province, District, Ward } from './entities/location.entity';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Province)
    private provincesRepository: Repository<Province>,
    @InjectRepository(District)
    private districtsRepository: Repository<District>,
    @InjectRepository(Ward)
    private wardsRepository: Repository<Ward>,
  ) {}

  async getProvinces(page = 1, limit = 10): Promise<PaginatedResult<Province>> {
    const [data, total] = await this.provincesRepository.findAndCount({
      order: { name: 'ASC' }, skip: (page - 1) * limit, take: limit,
    });
    return { data, meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async getDistricts(provinceId: number, page = 1, limit = 10): Promise<PaginatedResult<District>> {
    const [data, total] = await this.districtsRepository.findAndCount({
      where: { provinceId },
      order: { name: 'ASC' },
      skip: (page - 1) * limit, take: limit,
    });
    return { data, meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async getWards(districtId: number, page = 1, limit = 10): Promise<PaginatedResult<Ward>> {
    const [data, total] = await this.wardsRepository.findAndCount({
      where: { districtId },
      order: { name: 'ASC' },
      skip: (page - 1) * limit, take: limit,
    });
    return { data, meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }
}
