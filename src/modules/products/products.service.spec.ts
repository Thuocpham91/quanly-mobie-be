import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as xlsx from 'xlsx';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (dto) => dto),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('imports products from an Excel file', async () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Tên sản phẩm', 'Mã sản phẩm', 'Mã vạch', 'Nhà sản xuất', 'Giá gốc', 'Dịch vụ'],
      ['Sữa tươi', 'SP-001', '8938500001', 'Vinamilk', '25000', 'false'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');

    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    const result = await service.importFromExcel(buffer as Buffer);

    expect(result.success).toBe(1);
    expect(result.failed).toEqual([]);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Sữa tươi',
        productCode: 'SP-001',
        barcode: '8938500001',
        manufacturer: 'Vinamilk',
        basePrice: 25000,
        isService: false,
      }),
    );
  });

  it('supports common Vietnamese import column names like Ten hang, Ma hang, Thuong hieu, Gia von', async () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Tên hàng', 'Mã hàng', 'Mã vạch', 'Thương hiệu', 'Giá vốn', 'Dịch vụ'],
      ['Laptop Dell', 'LT-100', '123456789', 'Dell', '27800', 'true'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');

    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    const result = await service.importFromExcel(buffer as Buffer);

    expect(result.success).toBe(1);
    expect(result.failed).toEqual([]);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Laptop Dell',
        productCode: 'LT-100',
        barcode: '123456789',
        manufacturer: 'Dell',
        basePrice: 27800,
        isService: true,
      }),
    );
  });
});
