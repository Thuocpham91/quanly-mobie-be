import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateUnitDto extends CreateUnitDto {}
