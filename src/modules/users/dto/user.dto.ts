import { IsEmail, IsString, IsEnum, IsBoolean, IsOptional, MinLength, IsArray, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from '../entities/user.entity';

class BranchRoleAssignmentDto {
  @IsString()
  branchId: string;

  @IsString()
  roleId: string;
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @IsString()
  fullName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchRoleAssignmentDto)
  @IsOptional()
  branchRoleAssignments?: BranchRoleAssignmentDto[];

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  idCard?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsDateString()
  @IsOptional()
  hireDate?: string;

  @IsString()
  @IsOptional()
  specialties?: string;

  @IsBoolean()
  @IsOptional()
  englishProficiency?: boolean;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchRoleAssignmentDto)
  @IsOptional()
  branchRoleAssignments?: BranchRoleAssignmentDto[];

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  idCard?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsDateString()
  @IsOptional()
  hireDate?: string;

  @IsString()
  @IsOptional()
  specialties?: string;

  @IsBoolean()
  @IsOptional()
  englishProficiency?: boolean;
}
