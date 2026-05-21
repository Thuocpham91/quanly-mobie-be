import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateItemGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateItemGroupDto extends CreateItemGroupDto {}
