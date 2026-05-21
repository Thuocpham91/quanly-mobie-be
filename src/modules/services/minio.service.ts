// import { Injectable, Logger } from "@nestjs/common";
// import { ConfigService } from "@nestjs/config";
// import { parse } from "path";
// import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
// import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// import { PresignedUrlDto } from "src/modules/common/dtos/presigned-url.response.dto";
// import { Readable } from "stream";

// interface UploadBufferDto {
//   fileName: string;
//   buffer: Buffer;
//   contentType?: string;
// }

// @Injectable()
// export class MinioStorageService {
//   private readonly logger = new Logger(MinioStorageService.name);
//   private readonly s3Client: S3Client;
//   private readonly bucket: string;

//   constructor(private readonly configService: ConfigService) {
//     this.bucket = this.configService.get("S3_BUCKET_NAME");

//     this.s3Client = new S3Client({
//       region: this.configService.get("S3_REGION"),
//       credentials: {
//         accessKeyId: this.configService.get("S3_ACCESS_KEY"),
//         secretAccessKey: this.configService.get("S3_SECRET_KEY"),
//       },
//     });
//   }

//   private async handleS3<T>(fn: () => Promise<T>, action: string): Promise<T> {
//     try {
//       return await fn();
//     } catch (error: any) {
//       this.logger.error(`S3 ${action} failed: ${error.message}`, error.stack);
//       throw new Error(`S3 ${action} failed: ${error.message}`);
//     }
//   }

//   async uploadImageByBuffer(dto: UploadBufferDto): Promise<{ etag: string; versionId?: string }> {
//     const { fileName, buffer, contentType = "application/octet-stream" } = dto;
//     const command = new PutObjectCommand({
//       Bucket: this.bucket,
//       Key: fileName,
//       Body: buffer,
//       ContentType: contentType,
//     });
//     const result = await this.handleS3(() => this.s3Client.send(command), "upload");
//     return { etag: result.ETag, versionId: result.VersionId };
//   }

//   async getObject(filePath: string): Promise<Readable> {
//     const command = new GetObjectCommand({
//       Bucket: this.bucket,
//       Key: filePath,
//     });
//     const result = await this.handleS3(() => this.s3Client.send(command), "get object");
//     return result.Body as Readable;
//   }

//   async removeFilesByKeys(keys: string[]): Promise<void> {
//     if (!keys.length) return;
//     const command = new DeleteObjectsCommand({
//       Bucket: this.bucket,
//       Delete: {
//         Objects: keys.map(key => ({ Key: key })),
//       },
//     });
//     await this.handleS3(() => this.s3Client.send(command), "remove files");
//   }

//   async presignedPutUrl(fileName: string, path = "", expiry = 24 * 60 * 60): Promise<PresignedUrlDto> {
//     const { ext, name } = parse(fileName);
//     const key = `${path}${name}_${Date.now()}${ext}`;
//     const command = new PutObjectCommand({
//       Bucket: this.bucket,
//       Key: key,
//     });
//     const url = await getSignedUrl(this.s3Client, command, { expiresIn: expiry });
//     return { key, url };
//   }

//   async presignedGetUrl(fileName: string, expiry = 24 * 60 * 60): Promise<string> {
//     const command = new GetObjectCommand({
//       Bucket: this.bucket,
//       Key: fileName,
//     });
//     return getSignedUrl(this.s3Client, command, { expiresIn: expiry });
//   }

//   async getPublicUrl(objectKey: string): Promise<string> {
//     const region = this.configService.get<string>("S3_REGION");
//     return `https://${this.bucket}.s3.${region}.amazonaws.com/${objectKey}`;
//   }

//   async multiplePresignedPutUrls(fileNames: string[], path = ""): Promise<PresignedUrlDto[]> {
//     return Promise.all(fileNames.map((f) => this.presignedPutUrl(f, path)));
//   }

//   async isExist(fileName: string): Promise<boolean> {
//     try {
//       const command = new HeadObjectCommand({
//         Bucket: this.bucket,
//         Key: fileName,
//       });
//       await this.s3Client.send(command);
//       return true;
//     } catch {
//       return false;
//     }
//   }
// }
