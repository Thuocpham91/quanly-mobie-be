import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';

import { AzureBlobStorageService } from '../services/azureBlobStorageService';

@Module({
  controllers: [FileController],
  providers: [FileService, AzureBlobStorageService],
  exports: [FileService],
})
export class FileModule {}
