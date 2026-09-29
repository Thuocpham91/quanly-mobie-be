import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as xlsx from 'xlsx';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';
import { InventoryLog } from '../inventory/entities/inventory-log.entity';
import { InventoryOrder } from '../inventory/entities/inventory-order.entity';
import { Distributor } from '../distributors/entities/distributor.entity';

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let inventoryRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let inventoryLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let importOrderRepository: {
    create: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let distributorRepository: {
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
    inventoryRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn(async (dto) => ({ ...dto, id: 'batch-1' })),
      find: jest.fn(),
    };
    inventoryLogRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn(async (dto) => dto),
    };
    importOrderRepository = {
      create: jest.fn((dto) => dto),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (dto) => ({ ...dto, id: 'import-order-1' })),
      update: jest.fn(async () => undefined),
    };
    distributorRepository = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (dto) => ({ ...dto, id: 'distributor-1' })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: repository,
        },
        {
          provide: getRepositoryToken(InventoryBatch),
          useValue: inventoryRepository,
        },
        {
          provide: getRepositoryToken(InventoryLog),
          useValue: inventoryLogRepository,
        },
        {
          provide: getRepositoryToken(InventoryOrder),
          useValue: importOrderRepository,
        },
        {
          provide: getRepositoryToken(Distributor),
          useValue: distributorRepository,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('imports products from an Excel file', async () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Tên sản phẩm', 'Mã sản phẩm', 'Mã vạch', 'Nhà sản xuất', 'Giá nhập', 'Dịch vụ'],
      ['Sữa tươi', 'SP-001', '8938500001', 'Vinamilk', '25000', 'false'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');

    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    const result = await service.importFromExcel(buffer as Buffer, 'branch-1');

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

  it('groups imported products into an InventoryImportOrder using the source import code', async () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Mã nhập hàng', 'Tên sản phẩm', 'Mã hàng', 'Giá nhập', 'Số lượng'],
      ['NK-2026-001', 'Sản phẩm A', 'SP-A', '10000', '2'],
      ['NK-2026-001', 'Sản phẩm B', 'SP-B', '15000', '3'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');

    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    repository.findOne.mockResolvedValue(null);
    importOrderRepository.save.mockImplementation(async (order) => ({
      ...order,
      id: 'source-import-order',
    }));

    const result = await service.importFromExcel(buffer as Buffer, 'branch-1', 'user-1');

    expect(result).toEqual({ success: 2, failed: [] });
    expect(importOrderRepository.create).toHaveBeenCalledTimes(1);
    expect(importOrderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'NK-2026-001',
        invoiceName: 'NK-2026-001',
        branchId: 'branch-1',
      }),
    );
    expect(inventoryRepository.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ importOrderId: 'source-import-order' }),
    );
    expect(inventoryRepository.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ importOrderId: 'source-import-order' }),
    );
    expect(importOrderRepository.update).toHaveBeenNthCalledWith(
      1,
      'source-import-order',
      expect.objectContaining({
        totalAmount: 20000,
        totalProductAmount: 20000,
        totalQuantity: 2,
        totalItemCount: 1,
      }),
    );
    expect(importOrderRepository.update).toHaveBeenLastCalledWith(
      'source-import-order',
      expect.objectContaining({ totalAmount: 65000 }),
    );
  });

  it('stores import header totals on InventoryOrder, not on Product', async () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      [
        'Mã nhập hàng',
        'Tên hàng',
        'Mã hàng',
        'Giá nhập',
        'Số lượng',
        'Thành tiền',
        'Tổng tiền hàng',
        'Giảm giá phiếu nhập',
        'Cần trả NCC',
        'Tiền đã trả NCC',
        'Tổng số lượng',
        'Tổng số mặt hàng',
      ],
      ['NK-2026-002', 'Sản phẩm A', 'SP-A', '10000', '2', '20000', '30000', '1000', '29000', '10000', '3', '2'],
      ['NK-2026-002', 'Sản phẩm B', 'SP-B', '5000', '1', '5000', '99999', '5000', '88888', '77777', '99', '77'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const result = await service.importFromExcel(buffer as Buffer, 'branch-1', 'user-1');

    expect(result).toEqual({ success: 2, failed: [] });
    expect(repository.create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        totalAmount: expect.anything(),
        canTraNcc: expect.anything(),
        tienTraNcc: expect.anything(),
      }),
    );
    expect(importOrderRepository.update).toHaveBeenNthCalledWith(
      1,
      'import-order-1',
      expect.objectContaining({
        totalProductAmount: 30000,
        discountAmount: 1000,
        debtAmount: 29000,
        paidAmount: 10000,
        totalQuantity: 3,
        totalItemCount: 2,
      }),
    );
    expect(importOrderRepository.update).toHaveBeenNthCalledWith(
      2,
      'import-order-1',
      expect.not.objectContaining({
        totalProductAmount: expect.anything(),
        debtAmount: expect.anything(),
        paidAmount: expect.anything(),
        totalQuantity: expect.anything(),
        totalItemCount: expect.anything(),
      }),
    );
    expect(inventoryRepository.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ lineTotal: 20000 }),
    );
    expect(inventoryRepository.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ lineTotal: 5000 }),
    );
  });

  it('stores discount percent and amount separately on imported inventory batches', async () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Tên hàng', 'Mã hàng', 'Giảm giá %', 'Giảm giá', 'Giá nhập', 'Số lượng'],
      ['Sản phẩm giảm giá', 'SP-DISCOUNT', '12.5', '15000', '100000', '2'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const result = await service.importFromExcel(buffer as Buffer, 'branch-1');

    expect(result).toEqual({ success: 1, failed: [] });
    expect(inventoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        discountPercent: 12.5,
        discountAmount: 15000,
      }),
    );
    expect(importOrderRepository.update).toHaveBeenCalledWith(
      'import-order-1',
      expect.objectContaining({
        discountPercent: 12.5,
        discountAmount: 15000,
      }),
    );
  });

  it('stores Serial/IMEI on the batch and links the supplier to InventoryOrder', async () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Mã nhập hàng', 'Tên hàng', 'Mã hàng', 'Mã nhà cung cấp', 'Tên nhà cung cấp', 'Serial/IMEI', 'Giá nhập', 'Số lượng'],
      ['NK-IMEI-001', 'Điện thoại', 'SP-IMEI', 'NCC-IMEI', 'Nhà cung cấp IMEI', 'IMEI001, IMEI002', '1000000', '2'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    repository.findOne.mockResolvedValue(null);
    distributorRepository.findOne.mockResolvedValue(null);
    distributorRepository.save.mockImplementation(async (dto) => ({
      ...dto,
      id: 'distributor-imei',
    }));
    importOrderRepository.save.mockImplementation(async (dto) => ({
      ...dto,
      id: 'import-order-imei',
    }));

    const result = await service.importFromExcel(buffer as Buffer, 'branch-1', 'user-1');

    expect(result).toEqual({ success: 1, failed: [] });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ imeis: ['IMEI001', 'IMEI002'] }),
    );
    expect(inventoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ imeis: ['IMEI001', 'IMEI002'] }),
    );
    expect(importOrderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ distributorId: 'distributor-imei' }),
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

    const result = await service.importFromExcel(buffer as Buffer, 'branch-1');

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

  it('uses the supplier name column to create new distributors without overwriting the product manufacturer', async () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Tên sản phẩm', 'Mã hàng', 'Mã nhà cung cấp', 'Tên nhà cung cấp', 'Điện thoại', 'Nhà sản xuất', 'Giá nhập', 'Số lượng'],
      ['Sữa tươi', 'SP-002', 'NCC-002', 'Công ty ABC', '0901234567', 'Vinamilk', '25000', '10'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');

    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    distributorRepository.findOne.mockResolvedValue(null);
    repository.findOne.mockResolvedValue(null);

    const result = await service.importFromExcel(buffer as Buffer, 'branch-1', 'user-1');

    expect(result.success).toBe(1);
    expect(result.failed).toEqual([]);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Sữa tươi',
        manufacturer: 'Vinamilk',
      }),
    );
    expect(distributorRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'NCC-002',
        name: 'Công ty ABC',
        phone: '0901234567',
      }),
    );
  });

  it('repairs an existing distributor name when it was previously stored as the supplier code', async () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Tên sản phẩm', 'Mã hàng', 'Mã nhà cung cấp', 'Tên nhà cung cấp', 'Điện thoại', 'Giá nhập', 'Số lượng'],
      ['Sữa tươi', 'SP-003', 'NCC-003', 'Công ty XYZ', '0912345678', '25000', '10'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');

    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    distributorRepository.findOne.mockResolvedValue({
      id: 'distributor-old',
      code: 'NCC-003',
      name: 'NCC-003',
      phone: null,
    });
    repository.findOne.mockResolvedValue(null);

    const result = await service.importFromExcel(buffer as Buffer, 'branch-1', 'user-1');

    expect(result.success).toBe(1);
    expect(distributorRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'distributor-old',
        code: 'NCC-003',
        name: 'Công ty XYZ',
        phone: '0912345678',
      }),
    );
  });

  it('returns the supplier name for product import history instead of its code', async () => {
    inventoryRepository.find.mockResolvedValue([
      {
        distributor: { code: 'NCC-001', name: 'Công ty ABC' },
        importOrder: { distributor: { code: 'NCC-OLD', name: 'Nhà cung cấp từ phiếu' } },
      },
      {
        distributor: null,
        importOrder: { distributor: { code: 'NCC-002', name: 'Công ty XYZ' } },
      },
    ]);

    const history = await service.getProductImportHistory('product-1');

    expect(history.map((batch: any) => batch.supplierName)).toEqual([
      'Công ty ABC',
      'Công ty XYZ',
    ]);
  });
});
