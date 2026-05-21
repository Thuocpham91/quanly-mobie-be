import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class UploadFileResponseDto {
  @Expose()
  @ApiProperty({ example: "mitt.jpg" })
  key: string;

  @Expose()
  @ApiProperty({ example: "http://minio.myapp.com/my-app-bucket/mitt.jpg" })
  url: string;

  @Expose()
  @ApiProperty({ example: "e63a6733ac09172ac5fc4a2710c3d6d4" })
  etag: string;

  @Expose()
  @ApiProperty({ example: 121708 })
  size: number;

  @Expose()
  @ApiProperty({ example: "image/jpeg" })
  contentType: string;
}
