import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unit } from './entities/unit.entity';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit)
    private unitsRepository: Repository<Unit>,
  ) {}

  async findAll(): Promise<Unit[]> {
    return this.unitsRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Unit> {
    const unit = await this.unitsRepository.findOne({ where: { id } });
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }
    return unit;
  }

  async create(createUnitDto: CreateUnitDto): Promise<Unit> {
    const unit = this.unitsRepository.create(createUnitDto);
    return this.unitsRepository.save(unit);
  }

  async update(id: string, updateUnitDto: UpdateUnitDto): Promise<Unit> {
    await this.findOne(id);
    await this.unitsRepository.update(id, updateUnitDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const unit = await this.findOne(id);
    await this.unitsRepository.remove(unit);
  }
}
