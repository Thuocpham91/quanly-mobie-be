import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemGroup } from './entities/item-group.entity';
import { CreateItemGroupDto, UpdateItemGroupDto } from './dto/item-group.dto';

@Injectable()
export class ItemGroupsService {
  constructor(
    @InjectRepository(ItemGroup)
    private itemGroupsRepository: Repository<ItemGroup>,
  ) {}

  async findAll(): Promise<ItemGroup[]> {
    return this.itemGroupsRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<ItemGroup> {
    const itemGroup = await this.itemGroupsRepository.findOne({ where: { id } });
    if (!itemGroup) {
      throw new NotFoundException(`ItemGroup with ID ${id} not found`);
    }
    return itemGroup;
  }

  async create(createItemGroupDto: CreateItemGroupDto): Promise<ItemGroup> {
    const itemGroup = this.itemGroupsRepository.create(createItemGroupDto);
    return this.itemGroupsRepository.save(itemGroup);
  }

  async update(id: string, updateItemGroupDto: UpdateItemGroupDto): Promise<ItemGroup> {
    await this.findOne(id);
    await this.itemGroupsRepository.update(id, updateItemGroupDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const itemGroup = await this.findOne(id);
    await this.itemGroupsRepository.remove(itemGroup);
  }
}
