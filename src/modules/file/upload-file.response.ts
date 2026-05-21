import { ApiProperty } from "@nestjs/swagger";
import { UploadFileResponseDto } from "./upload-file.response.dto";

export class BaseResponse<T> {
  @ApiProperty({ example: "SUCCESS" })
  message: string;

  data: T;
}

export class UploadFileResponse extends BaseResponse<UploadFileResponseDto> {
  @ApiProperty({ type: UploadFileResponseDto })
  declare data: UploadFileResponseDto;
}

export class UploadFileListResponse extends BaseResponse<UploadFileResponseDto[]> {
  @ApiProperty({ type: [UploadFileResponseDto] })
  declare data: UploadFileResponseDto[];
}
