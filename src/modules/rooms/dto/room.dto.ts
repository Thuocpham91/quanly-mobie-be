import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  branchId: string;
}

export class UpdateRoomDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
