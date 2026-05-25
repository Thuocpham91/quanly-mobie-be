import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean, IsUUID } from 'class-validator';
import { PetGender } from '../entities/pet.entity';

export class CreatePetDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  species: string;

  @IsString()
  @IsOptional()
  breed?: string;

  @IsEnum(PetGender)
  @IsOptional()
  gender?: PetGender;

  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsOptional()
  ageType?: string;

  @IsNumber()
  @IsOptional()
  ageYears?: number;

  @IsNumber()
  @IsOptional()
  ageMonths?: number;

  @IsNumber()
  @IsOptional()
  ageDays?: number;

  @IsString()
  @IsOptional()
  furColor?: string;

  @IsString()
  @IsOptional()
  neutered?: string;

  @IsBoolean()
  @IsOptional()
  isCrossBreed?: boolean;

  @IsString()
  @IsOptional()
  habitat?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsUUID()
  @IsNotEmpty()
  ownerId: string;
}

export class UpdatePetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  species?: string;

  @IsString()
  @IsOptional()
  breed?: string;

  @IsEnum(PetGender)
  @IsOptional()
  gender?: PetGender;

  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsOptional()
  ageType?: string;

  @IsNumber()
  @IsOptional()
  ageYears?: number;

  @IsNumber()
  @IsOptional()
  ageMonths?: number;

  @IsNumber()
  @IsOptional()
  ageDays?: number;

  @IsString()
  @IsOptional()
  furColor?: string;

  @IsString()
  @IsOptional()
  neutered?: string;

  @IsBoolean()
  @IsOptional()
  isCrossBreed?: boolean;

  @IsString()
  @IsOptional()
  habitat?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}
