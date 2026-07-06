import { IsNotEmpty, IsOptional, IsString, IsObject, IsUUID } from 'class-validator';

export class RegisterFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsOptional()
  deviceType?: string;
}

export class SendNotificationTestDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsObject()
  @IsOptional()
  metadata?: any;
}
