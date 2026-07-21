import { Injectable, BadRequestException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { join } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";

import { UploadFileResponseDto } from "./upload-file.response.dto";
import { UploadFileResponse, UploadFileListResponse } from "./upload-file.response";
import { ErrorCode, SuccessCode } from "./message-code.enum";
import { AzureBlobStorageService } from "../services/azureBlobStorageService";
import { MulterFile } from "./multer-file.interface";

@Injectable()
export class FileService {
  constructor(private readonly storageService: AzureBlobStorageService) {}

  private readonly CONFIG = {
    MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
    MAX_FILE_NAME_LENGTH: 255,
    MAX_FILES_COUNT: 50,

    ALLOWED_EXTENSIONS: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "jfif", "heic", "heif", "avif", "tiff", "ico", "pdf", "csv"],
    BLACKLIST_EXTENSIONS: ["exe", "js", "sh", "bat", "cmd"],

    ALLOWED_MIME_TYPES: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "image/bmp",
      "application/pdf",
      "text/csv",
    ],
    BLACKLIST_MIME_TYPES: ["application/x-msdownload", "application/javascript", "application/x-sh"],
  };

  /* ================= UPLOAD ================= */

  async uploadSingleFile(file: MulterFile): Promise<UploadFileResponse> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const data = await this.uploadFile(file);

    return { message: SuccessCode.SUCCESS, data };
  }

  async uploadMultipleFiles(files: MulterFile[]): Promise<UploadFileListResponse> {
    if (!files || !files.length) {
      if ((files as any)?.buffer || (files as any)?.originalname) {
        files = [files as any];
      } else {
        throw new BadRequestException("Không có file nào được chọn để tải lên");
      }
    }

    const uploadedFiles: UploadFileResponseDto[] = [];
    let count = 0;

    for (const file of files) {
      this.validateFileCount(++count);
      uploadedFiles.push(await this.uploadFile(file));
    }

    return { message: SuccessCode.SUCCESS, data: uploadedFiles };
  }

  /* ================= DOWNLOAD ================= */

  async getFileStream(key: string) {
    const stream = await this.storageService.getObjectStream(key);
    const info = await this.storageService.getBlobInfo(key);

    return {
      stream,
      meta: {
        fileName: key,
        mimeType: info.contentType,
        size: info.size,
      },
    };
  }

  async getFileInfo(key: string) {
    const info = await this.storageService.getBlobInfo(key);

    const url = await this.storageService.getPublicUrl(key);

    console.log("Generated signed URL:", {
      key,
      size: info.size,
      contentType: info.contentType,
      etag: info.etag,
      lastModified: info.lastModified,
      metadata: info.metadata,
      url: url,
    });

    return {
      key,
      size: info.size,
      contentType: info.contentType,
      etag: info.etag,
      lastModified: info.lastModified,
      metadata: info.metadata,
      url: url,
    };
  }

  async deleteFiles(keys: string[]): Promise<void> {
    await this.storageService.deleteObjects(keys);
  }

  /* ================= INTERNAL ================= */

  private async uploadFile(file: MulterFile): Promise<UploadFileResponseDto> {
    this.validateFileNameAndType(file.originalname, file.mimetype);

    if (file.size > this.CONFIG.MAX_FILE_SIZE) {
      throw new BadRequestException("File size exceeds 20MB limit");
    }

    const uniqueName = this.generateUniqueFileName(file.originalname);

    try {
      const { etag } = await this.storageService.uploadBuffer(
        uniqueName,
        file.buffer,
        file.mimetype,
      );

      const url = await this.storageService.getPublicUrl(uniqueName);

      return {
        key: uniqueName,
        etag: etag || "",
        contentType: file.mimetype,
        size: file.size,
        url,
      };
    } catch (azureErr) {
      // Azure storage fallback: write file to local uploads directory
      try {
        const uploadDir = join(process.cwd(), "uploads", "products");
        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = join(uploadDir, uniqueName);
        writeFileSync(filePath, file.buffer);
        const url = `/uploads/products/${uniqueName}`;

        return {
          key: uniqueName,
          etag: "",
          contentType: file.mimetype,
          size: file.size,
          url,
        };
      } catch (localErr: any) {
        throw new BadRequestException(
          `Upload failed: ${azureErr?.message || localErr?.message}`,
        );
      }
    }
  }

  private generateUniqueFileName(fileName: string): string {
    const ext = fileName.split(".").pop();
    const name = fileName.replace(`.${ext}`, "");

    return `${name}_${Date.now()}_${uuidv4()}.${ext}`;
  }

  private validateFileCount(count: number) {
    if (count > this.CONFIG.MAX_FILES_COUNT) {
      throw new BadRequestException(
        `You can only upload up to ${this.CONFIG.MAX_FILES_COUNT} files`,
      );
    }
  }

  private validateFileNameAndType(fileName: string, contentType: string) {
    const {
      MAX_FILE_NAME_LENGTH,
      ALLOWED_EXTENSIONS,
      BLACKLIST_EXTENSIONS,
      ALLOWED_MIME_TYPES,
      BLACKLIST_MIME_TYPES,
    } = this.CONFIG;

    if (!fileName || fileName.length > MAX_FILE_NAME_LENGTH) {
      throw new BadRequestException("Invalid file name");
    }

    const ext = fileName.split(".").pop()?.toLowerCase();
    if (
      !ext ||
      !ALLOWED_EXTENSIONS.includes(ext) ||
      BLACKLIST_EXTENSIONS.includes(ext)
    ) {
      throw new BadRequestException(`Định dạng file .${ext} không được hỗ trợ`);
    }

    const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "jfif", "heic", "heif", "avif", "tiff", "ico"].includes(
      ext,
    );
    if (!isImage) {
      if (
        !ALLOWED_MIME_TYPES.includes(contentType) ||
        BLACKLIST_MIME_TYPES.includes(contentType)
      ) {
        throw new BadRequestException(`Mime type ${contentType} không được hỗ trợ`);
      }
    }
  }
}
