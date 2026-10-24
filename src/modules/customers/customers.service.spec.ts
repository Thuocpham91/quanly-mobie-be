import { Test, TestingModule } from '@nestjs/testing';
import * as XLSX from 'xlsx';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (dto) => dto),
      update: jest.fn(),
    };
    const ordersRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };
    const usersService = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    service = new CustomersService(repository as any, usersService as any, ordersRepository as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create customers without a phone number', async () => {
    await service.create({ fullName: 'Nguyễn Văn A' });

    const createdCustomer = (service as any).customersRepository.create.mock.calls[0][0];
    expect(createdCustomer.phone).toBeNull();
  });

  it('should normalize an empty phone number to null', async () => {
    await service.create({ fullName: 'Nguyễn Văn A', phone: '  ' });

    const createdCustomer = (service as any).customersRepository.create.mock.calls[0][0];
    expect(createdCustomer.phone).toBeNull();
  });

  it('should search customers by customer code', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const customersRepository = (service as any).customersRepository;
    customersRepository.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);

    await service.search('KH-001');

    expect(queryBuilder.where).toHaveBeenCalledWith(
      expect.stringContaining('customer.code ILIKE :query'),
      { query: '%KH-001%' },
    );
  });

  it('should calculate customer sales and outstanding debt from completed orders', async () => {
    const customer = { id: 'customer-1', totalSales: 0, currentDebt: 0, totalSalesMinusReturns: 0 };
    const customersRepository = (service as any).customersRepository;
    customersRepository.findAndCount.mockResolvedValue([[customer], 1]);

    const ordersRepository = (service as any).ordersRepository;
    const orderQuery = ordersRepository.createQueryBuilder();
    orderQuery.getRawMany.mockResolvedValue([
      { customerId: customer.id, totalSales: '125000', currentDebt: '25000' },
    ]);

    const result = await service.findAll('branch-1');

    expect(result.data[0]).toMatchObject({
      totalSales: 125000,
      currentDebt: 25000,
      totalSalesMinusReturns: 125000,
    });
    expect(orderQuery.where).toHaveBeenCalledWith(
      'order.customerId IN (:...customerIds)',
      { customerIds: [customer.id] },
    );
    expect(orderQuery.andWhere).toHaveBeenCalledWith('order.status = :status', {
      status: 'COMPLETED',
    });
    expect(orderQuery.andWhere).toHaveBeenCalledWith('order.branchId = :branchId', {
      branchId: 'branch-1',
    });
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
