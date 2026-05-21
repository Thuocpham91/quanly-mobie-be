import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { CageStatus } from '../entities/cage.entity';

export class CreateCageDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(CageStatus)
  @IsOptional()
  status?: CageStatus;
}

export class UpdateCageDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(CageStatus)
  @IsOptional()
  status?: CageStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  petId?: string;
}
