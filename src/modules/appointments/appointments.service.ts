import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentsRepository: Repository<Appointment>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createAppointmentDto: CreateAppointmentDto): Promise<Appointment> {
    const appointment = this.appointmentsRepository.create(createAppointmentDto);
    const saved = await this.appointmentsRepository.save(appointment);
    if (saved.userId) {
      try {
        await this.notificationsService.sendNotificationToUser(saved.userId, {
          title: 'Công việc mới',
          content: `Bạn được giao công việc mới: ${saved.purpose}`,
          type: 'info',
          metadata: {
            appointmentId: saved.id,
          },
        });
      } catch (err) {
        console.error('Failed to send task assignment notification:', err);
      }
    }
    return saved;
  }

  async findAll(branchId?: string, page: number = 1, limit: number = 10): Promise<PaginatedResult<Appointment>> {
    const whereClause: any = {};
    if (branchId) {
      whereClause.branchId = branchId;
    }
    const skip = (page - 1) * limit;

    const [data, total] = await this.appointmentsRepository.findAndCount({
      where: whereClause,
      relations: ['customer', 'user'],
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
      relations: ['customer', 'user'],
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
      order: { dateTime: 'ASC' },
    });
  }
}
