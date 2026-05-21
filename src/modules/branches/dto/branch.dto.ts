import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsOptional()
  provinceId?: number;

  @IsOptional()
  districtId?: number;

  @IsOptional()
  wardId?: number;
}

export class UpdateBranchDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  provinceId?: number;

  @IsOptional()
  districtId?: number;

  @IsOptional()
  wardId?: number;
}
