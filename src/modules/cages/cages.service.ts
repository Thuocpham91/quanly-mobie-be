import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cage } from './entities/cage.entity';
import { CreateCageDto, UpdateCageDto } from './dto/cage.dto';

@Injectable()
export class CagesService {
  constructor(
    @InjectRepository(Cage)
    private cagesRepository: Repository<Cage>,
  ) {}

  async findAll(roomId?: string): Promise<Cage[]> {
    const whereClause = roomId ? { roomId } : {};
    return this.cagesRepository.find({ 
      where: whereClause,
      order: { name: 'ASC' },
      relations: ['pet', 'pet.owner'] // Join pet and owner to display info on the cage
    });
  }

  async findOne(id: string): Promise<Cage> {
    const cage = await this.cagesRepository.findOne({ 
      where: { id },
      relations: ['pet', 'pet.owner']
    });
    if (!cage) {
      throw new NotFoundException(`Cage with ID ${id} not found`);
    }
    return cage;
  }

  async create(createCageDto: CreateCageDto): Promise<Cage> {
    const cage = this.cagesRepository.create(createCageDto);
    return this.cagesRepository.save(cage);
  }

  async update(id: string, updateCageDto: UpdateCageDto): Promise<Cage> {
    await this.findOne(id); // Ensure it exists
    await this.cagesRepository.update(id, updateCageDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const cage = await this.findOne(id);
    await this.cagesRepository.remove(cage);
  }
}
