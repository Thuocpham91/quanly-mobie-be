import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Province, District, Ward } from './entities/location.entity';

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

  async getProvinces(): Promise<Province[]> {
    return await this.provincesRepository.find({ order: { name: 'ASC' } });
  }

  async getDistricts(provinceId: number): Promise<District[]> {
    return await this.districtsRepository.find({
      where: { provinceId },
      order: { name: 'ASC' },
    });
  }

  async getWards(districtId: number): Promise<Ward[]> {
    return await this.wardsRepository.find({
      where: { districtId },
      order: { name: 'ASC' },
    });
  }
}
