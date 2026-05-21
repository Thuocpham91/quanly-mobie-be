import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { AppointmentStatus } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  petId: string;

  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsDateString()
  @IsNotEmpty()
  dateTime: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateAppointmentDto {
  @IsDateString()
  @IsOptional()
  dateTime?: string;

  @IsString()
  @IsOptional()
  purpose?: string;

  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
