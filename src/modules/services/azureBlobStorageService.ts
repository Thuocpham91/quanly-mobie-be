import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BlobServiceClient,
  ContainerClient,
  BlockBlobClient,
  BlobSASPermissions,
} from "@azure/storage-blob";
import { Readable } from "stream";

@Injectable()
export class AzureBlobStorageService implements OnModuleInit {
  private readonly logger = new Logger(AzureBlobStorageService.name);

  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerClient: ContainerClient;

  private readonly container: string;
  private readonly accountName: string;

  constructor(private readonly config: ConfigService) {
    this.container = this.config.get<string>(
      "AZURE_STORAGE_CONTAINER_NAME",
    ) as string;

    this.accountName = this.config.get<string>(
      "AZURE_STORAGE_ACCOUNT_NAME",
    ) as string;

    const connectionString = this.config.get<string>(
      "AZURE_STORAGE_CONNECTION_STRING",
    );

    if (!connectionString) {
      throw new Error("AZURE_STORAGE_CONNECTION_STRING is missing");
    }

    this.blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);

    this.containerClient =
      this.blobServiceClient.getContainerClient(this.container);
  }

  /* ================== INIT ================== */
  async onModuleInit() {
    await this.ensureContainer();
  }

  private async ensureContainer() {
    try {
      const exists = await this.containerClient.exists();
      if (!exists) {
        await this.containerClient.create({ access: "blob" });
        this.logger.log(`Container "${this.container}" created`);
      }
    } catch (error: any) {
      this.logger.error("Ensure container failed: " + error.message);
      this.logger.warn("Azure Blob Storage is not correctly configured. File uploads to Azure will fail.");
    }
  }

  /* ================== INFO ================== */
  async getBlobInfo(blobName: string) {
    try {
      const blobClient = this.containerClient.getBlobClient(blobName);
      const properties = await blobClient.getProperties();

      return {
        key: blobName,
        contentType: properties.contentType,
        size: properties.contentLength,
        etag: properties.etag,
        lastModified: properties.lastModified,
        metadata: properties.metadata,
      };
    } catch (error: any) {
      if (error?.statusCode === 404) {
        throw new NotFoundException(`File ${blobName} not found`);
      }

      throw new InternalServerErrorException(
        `Failed to get blob info: ${error.message}`,
      );
    }
  }

  async getFileInfo(blobName: string) {
    const info = await this.getBlobInfo(blobName);
    return {
      ...info,
      url: this.getPublicUrl(blobName),
    };
  }

  /* ================== UPLOAD BUFFER ================== */
  async uploadBuffer(
    blobName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ etag?: string }> {
    try {
      const blockBlobClient =
        this.containerClient.getBlockBlobClient(blobName);

      const result = await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: contentType,
          blobCacheControl: "public, max-age=31536000",
          blobContentDisposition: "inline",
        },
      });

      return { etag: result.etag };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to upload buffer: ${error.message}`,
      );
    }
  }

  /* ================== UPLOAD STREAM ================== */
  async uploadStream(
    blobName: string,
    stream: Readable,
    contentType: string,
  ): Promise<{ etag?: string }> {
    try {
      const blockBlobClient =
        this.containerClient.getBlockBlobClient(blobName);

      const result = await blockBlobClient.uploadStream(
        stream,
        4 * 1024 * 1024, // buffer size
        20, // max concurrency
        {
          blobHTTPHeaders: {
            blobContentType: contentType,
          },
        },
      );

      return { etag: result.etag };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to upload stream: ${error.message}`,
      );
    }
  }

  /* ================== DOWNLOAD STREAM ================== */
  async getObjectStream(blobName: string): Promise<Readable> {
    try {
      const blockBlobClient =
        this.containerClient.getBlockBlobClient(blobName);

      const response = await blockBlobClient.download();
      return response.readableStreamBody as Readable;
    } catch (error: any) {
      if (error?.statusCode === 404) {
        throw new NotFoundException(`File ${blobName} not found`);
      }

      throw new InternalServerErrorException(
        `Failed to download blob: ${error.message}`,
      );
    }
  }

  /* ================== DOWNLOAD BUFFER ================== */
  async getObjectBuffer(blobName: string): Promise<Buffer> {
    try {
      const blockBlobClient =
        this.containerClient.getBlockBlobClient(blobName);

      return await blockBlobClient.downloadToBuffer();
    } catch (error: any) {
      if (error?.statusCode === 404) {
        throw new NotFoundException(`File ${blobName} not found`);
      }

      throw new InternalServerErrorException(
        `Failed to download blob buffer: ${error.message}`,
      );
    }
  }

  /* ================== DELETE ================== */
  async deleteObjects(blobNames: string[]): Promise<void> {
    if (!blobNames?.length) return;

    try {
      await Promise.all(
        blobNames.map((name) =>
          this.containerClient.deleteBlob(name, {
            deleteSnapshots: "include",
          }),
        ),
      );
    } catch (error: any) {
      this.logger.error("Delete blob failed", error);
      throw new InternalServerErrorException("Failed to delete blobs");
    }
  }

  /* ================== EXISTS ================== */
  async exists(blobName: string): Promise<boolean> {
    const blobClient = this.containerClient.getBlobClient(blobName);
    return blobClient.exists();
  }

  /* ================== URL ================== */
  getPublicUrl(blobName: string): string {
    return `https://${this.accountName}.blob.core.windows.net/${this.container}/${blobName}`;
  }

  /* ================== SIGNED URL (SAS) ================== */
  async getSignedUrl(
    blobName: string,
    expiresInMinutes = 15,
  ): Promise<string> {
    try {
      const blobClient = this.containerClient.getBlobClient(blobName);

      return blobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
      });
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to generate signed url: ${error.message}`,
      );
    }
  }
}
