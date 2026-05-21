import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
  ) {}

  async findAll(branchId?: string): Promise<Room[]> {
    const whereClause = branchId ? { branchId } : {};
    return this.roomsRepository.find({ 
      where: whereClause,
      order: { createdAt: 'ASC' },
      relations: ['cages', 'cages.pet', 'cages.pet.owner']
    });
  }

  async findOne(id: string): Promise<Room> {
    const room = await this.roomsRepository.findOne({ where: { id } });
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }
    return room;
  }

  async create(createRoomDto: CreateRoomDto): Promise<Room> {
    const room = this.roomsRepository.create(createRoomDto);
    return this.roomsRepository.save(room);
  }

  async update(id: string, updateRoomDto: UpdateRoomDto): Promise<Room> {
    await this.findOne(id);
    await this.roomsRepository.update(id, updateRoomDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const room = await this.findOne(id);
    await this.roomsRepository.remove(room);
  }
}
