import { Test, TestingModule } from '@nestjs/testing';
import * as XLSX from 'xlsx';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (dto) => dto),
      update: jest.fn(),
    };
    const usersService = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    service = new CustomersService(repository as any, usersService as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should parse year-first last purchase date from Excel import correctly', async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Tên khách hàng', 'Điện thoại', 'Ngày giao dịch cuối'],
      ['Nguyễn Văn A', '0901234567', '2024/06/30'],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const response = await service.importExcel(buffer);

    expect(response.success).toBe(1);
    expect(response.failed).toEqual([]);

    const createdCustomer = (service as any).customersRepository.create.mock.calls[0][0];
    expect(createdCustomer.lastPurchaseDate).toBeInstanceOf(Date);
    expect(createdCustomer.lastPurchaseDate.getFullYear()).toBe(2024);
    expect(createdCustomer.lastPurchaseDate.getMonth()).toBe(5);
    expect(createdCustomer.lastPurchaseDate.getDate()).toBe(30);
  });
});
