import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('uploads/orders/:fileName')
  downloadOrderImportErrorFile(@Param('fileName') fileName: string, @Res() res: Response) {
    const safeFileName = path.basename(fileName);
    const filePath = path.join(process.cwd(), 'uploads', 'orders', safeFileName);

    if (!safeFileName || !fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    res.download(filePath, safeFileName);
  }
}
