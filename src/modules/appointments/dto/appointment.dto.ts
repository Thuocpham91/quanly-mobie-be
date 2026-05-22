import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { AppointmentStatus } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @IsString()
  @IsOptional()
  petId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsDateString()
  @IsNotEmpty()
  dateTime: string;

  @IsDateString()
  @IsOptional()
  endDateTime?: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  userId?: string;
}

export class UpdateAppointmentDto {
  @IsDateString()
  @IsOptional()
  dateTime?: string;

  @IsDateString()
  @IsOptional()
  endDateTime?: string;

  @IsString()
  @IsOptional()
  purpose?: string;

  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  userId?: string;
}
