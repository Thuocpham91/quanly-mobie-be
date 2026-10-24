import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { basename, extname, join, resolve } from "path";
import { createReadStream } from "fs";
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import { createHash } from "crypto";

import { UploadFileResponseDto } from "./upload-file.response.dto";
import { UploadFileResponse, UploadFileListResponse } from "./upload-file.response";
import { SuccessCode } from "./message-code.enum";
import { MulterFile } from "./multer-file.interface";

@Injectable()
export class FileService {
  private readonly uploadDir = resolve(process.cwd(), "uploads", "products");

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
    const filePath = this.getFilePath(key);
    const fileStat = await this.getFileStat(filePath, key);

    return {
      stream: createReadStream(filePath),
      meta: {
        fileName: key,
        mimeType: this.getContentType(key),
        size: fileStat.size,
      },
    };
  }

  async getFileInfo(key: string) {
    const filePath = this.getFilePath(key);
    const [fileStat, buffer] = await Promise.all([
      this.getFileStat(filePath, key),
      this.readFile(filePath, key),
    ]);
    const contentType = this.getContentType(key);

    return {
      key,
      size: fileStat.size,
      contentType,
      etag: this.getEtag(buffer),
      lastModified: fileStat.mtime,
      metadata: undefined,
      url: this.getPublicUrl(key),
    };
  }

  async deleteFiles(keys: string[]): Promise<void> {
    if (!keys?.length) {
      return;
    }

    await Promise.all(
      keys.map(async (key) => {
        const filePath = this.getFilePath(key);
        try {
          await unlink(filePath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw new InternalServerErrorException(
              `Failed to delete file ${key}`,
            );
          }
        }
      }),
    );
  }

  /* ================= INTERNAL ================= */

  private async uploadFile(file: MulterFile): Promise<UploadFileResponseDto> {
    const originalName = basename(file.originalname);
    this.validateFileNameAndType(originalName, file.mimetype);

    if (file.size > this.CONFIG.MAX_FILE_SIZE) {
      throw new BadRequestException("File size exceeds 20MB limit");
    }

    const uniqueName = this.generateUniqueFileName(originalName);

    try {
      await mkdir(this.uploadDir, { recursive: true });
      await writeFile(this.getFilePath(uniqueName), file.buffer);

      return {
        key: uniqueName,
        etag: this.getEtag(file.buffer),
        contentType: file.mimetype,
        size: file.size,
        url: this.getPublicUrl(uniqueName),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private generateUniqueFileName(fileName: string): string {
    const ext = extname(fileName);
    const name = fileName.slice(0, -ext.length);

    return `${name}_${Date.now()}_${uuidv4()}${ext}`;
  }

  private getFilePath(key: string): string {
    if (!key || basename(key) !== key || key === "." || key === "..") {
      throw new BadRequestException("Invalid file name");
    }

    return join(this.uploadDir, key);
  }

  private getPublicUrl(key: string): string {
    return `/uploads/products/${encodeURIComponent(key)}`;
  }

  private getContentType(key: string): string {
    const contentTypes: Record<string, string> = {
      ".avif": "image/avif",
      ".bmp": "image/bmp",
      ".csv": "text/csv",
      ".gif": "image/gif",
      ".heic": "image/heic",
      ".heif": "image/heif",
      ".ico": "image/x-icon",
      ".jfif": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".jpg": "image/jpeg",
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".tif": "image/tiff",
      ".tiff": "image/tiff",
      ".webp": "image/webp",
    };

    return contentTypes[extname(key).toLowerCase()] || "application/octet-stream";
  }

  private getEtag(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  }

  private async getFileStat(filePath: string, key: string) {
    try {
      return await stat(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new NotFoundException(`File ${key} not found`);
      }

      throw new InternalServerErrorException(`Failed to read file ${key}`);
    }
  }

  private async readFile(filePath: string, key: string): Promise<Buffer> {
    try {
      return await readFile(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new NotFoundException(`File ${key} not found`);
      }

      throw new InternalServerErrorException(`Failed to read file ${key}`);
    }
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
