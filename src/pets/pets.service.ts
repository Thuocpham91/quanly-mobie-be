import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Pet } from './entities/pet.entity';
import { CustomersService } from '../customers/customers.service';

@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet)
    private petsRepository: Repository<Pet>,
    private customersService: CustomersService,
  ) {}

  findAll(): Promise<Pet[]> {
    return this.petsRepository.find({ relations: ['owner'], order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Pet> {
    const pet = await this.petsRepository.findOne({ where: { id }, relations: ['owner'] });
    if (!pet) {
      throw new NotFoundException(`Pet with ID ${id} not found`);
    }
    return pet;
  }

  async create(petData: any): Promise<Pet> {
    const { ownerId, ...details } = petData;
    const owner = await this.customersService.findOne(ownerId);
    
    const pet = this.petsRepository.create({
      ...details,
      owner,
    } as DeepPartial<Pet>);
    
    return this.petsRepository.save(pet);
  }

  async update(id: string, petData: any): Promise<Pet> {
    await this.findOne(id);
    await this.petsRepository.update(id, petData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const pet = await this.findOne(id);
    await this.petsRepository.remove(pet);
  }

  async findByOwner(ownerId: string): Promise<Pet[]> {
    return this.petsRepository.find({ where: { owner: { id: ownerId } } });
  }
}
