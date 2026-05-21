// import { Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
// import { ConfigService } from "@nestjs/config";
// import {
//   S3Client,
//   PutObjectCommand,
//   GetObjectCommand,
//   DeleteObjectsCommand,
//   HeadObjectCommand,
// } from "@aws-sdk/client-s3";
// import { Readable } from "stream";

// @Injectable()
// export class S3StorageService {
//   private readonly logger = new Logger(S3StorageService.name);
//   private readonly s3: S3Client;
//   private readonly bucket: string;
//   private readonly region: string;

//   constructor(private readonly config: ConfigService) {
//     this.bucket = this.config.get<string>("S3_BUCKET_NAME");
//     this.region = this.config.get<string>("S3_REGION");

//     this.s3 = new S3Client({
//       region: this.region,
//       credentials: {
//         accessKeyId: this.config.get("S3_ACCESS_KEY"),
//         secretAccessKey: this.config.get("S3_SECRET_KEY"),
//       },
//     });
//   }

//   async getImageInfo(key: string) {
//     try {
//       const result = await this.s3.send(
//         new HeadObjectCommand({
//           Bucket: this.bucket,
//           Key: key,
//         }),
//       );

//       return {
//         key,
//         contentType: result.ContentType,
//         size: result.ContentLength,
//         etag: result.ETag,
//         lastModified: result.LastModified,
//         metadata: result.Metadata,
//       };
//     } catch (error: any) {
//       // ❗ KHÔNG TÌM THẤY FILE
//       if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
//         throw new NotFoundException(`File with key ${key} not found`);
//       }

//       // ❗ LỖI KHÁC
//       throw new InternalServerErrorException(`Failed to get image info: ${error.message}`);
//     }
//   }

//   async getFileInfo(key: string) {
//     const head = await this.getImageInfo(key);

//     return {
//       ...head,
//       url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`,
//     };
//   }

//   async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<{ etag?: string }> {
//     const command = new PutObjectCommand({
//       Bucket: this.bucket,
//       Key: key,
//       Body: buffer,
//       ContentType: contentType,
//     });

//     const result = await this.s3.send(command);
//     return { etag: result.ETag };
//   }

//   async getObject(key: string): Promise<Readable> {
//     const command = new GetObjectCommand({
//       Bucket: this.bucket,
//       Key: key,
//     });

//     const result = await this.s3.send(command);
//     return result.Body as Readable;
//   }

//   async deleteObjects(keys: string[]): Promise<void> {
//     if (!keys.length) return;

//     const command = new DeleteObjectsCommand({
//       Bucket: this.bucket,
//       Delete: {
//         Objects: keys.map((k) => ({ Key: k })),
//       },
//     });

//     await this.s3.send(command);
//   }

//   async exists(key: string): Promise<boolean> {
//     try {
//       await this.s3.send(
//         new HeadObjectCommand({
//           Bucket: this.bucket,
//           Key: key,
//         }),
//       );
//       return true;
//     } catch {
//       return false;
//     }
//   }

//   getPublicUrl(key: string): string {
//     return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
//   }
// }
