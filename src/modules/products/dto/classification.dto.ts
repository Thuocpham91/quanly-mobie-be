import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateClassificationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateClassificationDto extends CreateClassificationDto {}
