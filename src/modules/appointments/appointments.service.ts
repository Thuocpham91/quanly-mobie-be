import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentsRepository: Repository<Appointment>,
  ) {}

  async create(createAppointmentDto: CreateAppointmentDto): Promise<Appointment> {
    const appointment = this.appointmentsRepository.create(createAppointmentDto);
    return this.appointmentsRepository.save(appointment);
  }

  async findAll(branchId?: string, page: number = 1, limit: number = 10): Promise<PaginatedResult<Appointment>> {
    const whereClause: any = {};
    if (branchId) {
      whereClause.branchId = branchId;
    }
    const skip = (page - 1) * limit;

    const [data, total] = await this.appointmentsRepository.findAndCount({
      where: whereClause,
      relations: ['pet', 'customer'],
      order: { dateTime: 'ASC' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Appointment> {
    const appointment = await this.appointmentsRepository.findOne({
      where: { id },
      relations: ['pet', 'customer'],
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }
    return appointment;
  }

  async update(id: string, updateAppointmentDto: UpdateAppointmentDto): Promise<Appointment> {
    await this.findOne(id);
    await this.appointmentsRepository.update(id, updateAppointmentDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const appointment = await this.findOne(id);
    await this.appointmentsRepository.remove(appointment);
  }

  async findByCustomer(customerId: string): Promise<Appointment[]> {
    return this.appointmentsRepository.find({
      where: { customerId },
      relations: ['pet'],
      order: { dateTime: 'ASC' },
    });
  }

  async findByPet(petId: string): Promise<Appointment[]> {
    return this.appointmentsRepository.find({
      where: { petId },
      relations: ['customer'],
      order: { dateTime: 'ASC' },
    });
  }
}
