import * as xlsx from 'xlsx';
import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';

describe('OrdersService', () => {
  it('updates order fields, replaces items, and recalculates order totals', async () => {
    const existingOrder = {
      id: 'order-1',
      orderCode: 'ORD-001',
      branchId: 'branch-1',
      subTotal: 1000,
      discount: 0,
      paidAmount: 0,
      totalAmount: 1000,
      totalQuantity: 1,
      items: [{ id: 'old-item' }],
    };
    const ordersRepository = {
      findOne: jest.fn().mockResolvedValue(existingOrder),
      save: jest.fn(async (order) => order),
    };
    const orderItemsRepository = {
      create: jest.fn((item) => item),
      delete: jest.fn(),
      save: jest.fn(async (items) => items),
    };
    const service = new OrdersService(
      ordersRepository as any,
      orderItemsRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const updatedOrder = await service.updateOrder('order-1', 'branch-1', {
      discount: 100,
      paidAmount: 1500,
      items: [
        {
          productId: 'product-1',
          quantity: 2,
          unitPrice: 1000,
          discountAmount: 500,
        },
      ],
    });

    expect(orderItemsRepository.delete).toHaveBeenCalledWith({ orderId: 'order-1' });
    expect(orderItemsRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        orderId: 'order-1',
        productId: 'product-1',
        totalPrice: 1500,
      }),
    ]);
    expect(updatedOrder).toEqual(
      expect.objectContaining({
        subTotal: 1500,
        discount: 100,
        paidAmount: 1500,
        totalAmount: 1400,
        totalQuantity: 2,
      }),
    );
  });

  it('returns order pagination metadata and applies page and limit to the query', async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'order-1' }], 23]),
    };
    const service = new OrdersService(
      { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.findAll('branch-1', '2', '10');

    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
    expect(result).toEqual({
      data: [{ id: 'order-1' }],
      total: 23,
      meta: { total: 23, page: 2, limit: 10, totalPages: 3 },
    });
  });

  it('imports order discount, customer-paid amount, and time from Excel', async () => {
    const ordersRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      create: jest.fn((data) => data),
      save: jest.fn(async (order) => ({ ...order, id: 'order-imported' })),
    };
    const orderItemsRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (items) => items),
    };
    const customersRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    const userBranchRoleRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };
    const productsRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'product-1' }),
      create: jest.fn((data) => data),
      save: jest.fn(async (product) => product),
    };
    const service = new OrdersService(
      ordersRepository as any,
      orderItemsRepository as any,
      customersRepository as any,
      userBranchRoleRepository as any,
      productsRepository as any,
      { deductStock: jest.fn() } as any,
      { sendNotificationToUser: jest.fn() } as any,
    );

    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Mã đơn', 'Mã hàng', 'Số lượng', 'Đơn giá', 'Giảm giá', 'Khách đã trả', 'Thời gian'],
      ['ORD-IMPORT-001', 'SKU-1', 2, 10000, 1500, 10000, 45672.4375],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    const result = await service.importOrdersFromExcel(buffer, 'branch-1', 'user-1');

    expect(result).toEqual(expect.objectContaining({ imported: 1, errors: [] }));
    expect(ordersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        discount: 1500,
        paidAmount: 10000,
        createdAt: new Date(Date.UTC(2025, 0, 15, 10, 30)),
      }),
    );
  });

  it('does not treat an item discount percentage as an order discount amount', async () => {
    const ordersRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      create: jest.fn((data) => data),
      save: jest.fn(async (order) => ({ ...order, id: 'order-imported' })),
    };
    const orderItemsRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (items) => items),
    };
    const service = new OrdersService(
      ordersRepository as any,
      orderItemsRepository as any,
      { findOne: jest.fn(), create: jest.fn(), save: jest.fn() } as any,
      { findOne: jest.fn().mockResolvedValue(null), find: jest.fn().mockResolvedValue([]) } as any,
      { findOne: jest.fn().mockResolvedValue({ id: 'product-1' }) } as any,
      { deductStock: jest.fn() } as any,
      { sendNotificationToUser: jest.fn() } as any,
    );
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Mã đơn', 'Mã hàng', 'Số lượng', 'Đơn giá', 'Giảm giá %'],
      ['ORD-DISCOUNT-001', 'SKU-1', 2, 10000, 10],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    const result = await service.importOrdersFromExcel(buffer, 'branch-1', 'user-1');

    expect(result).toEqual(expect.objectContaining({ imported: 1, errors: [] }));
    expect(ordersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ discount: 0, subTotal: 18000, totalAmount: 18000 }),
    );
  });

  it('assigns the saved order id to created order items', async () => {
    const ordersRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      create: jest.fn((data) => data),
      save: jest.fn(async (order) => ({ ...order, id: 'order-1' })),
    };

    const orderItemsRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (item) => item),
    };

    const customersRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const userBranchRoleRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };

    const productsRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'product-1' }),
    };

    const inventoryService = { deductStock: jest.fn() };
    const notificationsService = { sendNotificationToUser: jest.fn() };

    const service = new OrdersService(
      ordersRepository as any,
      orderItemsRepository as any,
      customersRepository as any,
      userBranchRoleRepository as any,
      productsRepository as any,
      inventoryService as any,
      notificationsService as any,
    );

    await service.create(
      {
        orderCode: 'ORD-TEST',
        items: [
          {
            productId: 'product-1',
            quantity: 2,
            unitPrice: 1000,
            discountPercent: 10,
          },
        ],
      } as any,
      'branch-1',
      'user-1',
      true,
    );

    const savedItems = orderItemsRepository.save.mock.calls[0][0];
    expect(savedItems[0].orderId).toBe('order-1');
    expect(savedItems[0].discountPercent).toBe(10);
    expect(savedItems[0].totalPrice).toBe(1800);
  });

  it('creates a missing product during import when the product code is not already present', async () => {
    const ordersRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      create: jest.fn((data) => data),
      save: jest.fn(async (order) => ({ ...order, id: 'order-1' })),
    };

    const orderItemsRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (item) => item),
    };

    const customersRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const userBranchRoleRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };

    const productsRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => data),
      save: jest.fn(async (product) => ({ ...product, id: 'product-2' })),
    };

    const inventoryService = { deductStock: jest.fn() };
    const notificationsService = { sendNotificationToUser: jest.fn() };

    const service = new OrdersService(
      ordersRepository as any,
      orderItemsRepository as any,
      customersRepository as any,
      userBranchRoleRepository as any,
      productsRepository as any,
      inventoryService as any,
      notificationsService as any,
    );

    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Mã đơn', 'Mã hàng', 'Số lượng'],
      ['ORD-002', 'SP999999', '1'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    const result = await service.importOrderDetailsFromExcel(
      buffer,
      'branch-1',
      'user-1',
      {
        createMissingOrders: true,
        skipStockDeduction: true,
      },
    );

    expect(result.errors).toHaveLength(0);
    expect(result.imported).toBe(1);
    expect(productsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'SP999999',
        productCode: 'SP999999',
        barcode: 'SP999999',
      }),
    );
  });

  it('defaults missing unit price to 0 when importing order details', async () => {
    const ordersRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      create: jest.fn((data) => data),
      save: jest.fn(async (order) => ({ ...order, id: 'order-1' })),
    };

    const orderItemsRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (item) => item),
    };

    const customersRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const userBranchRoleRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };

    const productsRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'product-1' }),
    };

    const inventoryService = { deductStock: jest.fn() };
    const notificationsService = { sendNotificationToUser: jest.fn() };

    const service = new OrdersService(
      ordersRepository as any,
      orderItemsRepository as any,
      customersRepository as any,
      userBranchRoleRepository as any,
      productsRepository as any,
      inventoryService as any,
      notificationsService as any,
    );

    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Mã đơn', 'Mã hàng', 'Số lượng'],
      ['ORD-001', 'SKU-1', '2'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    const result = await service.importOrderDetailsFromExcel(
      buffer,
      'branch-1',
      'user-1',
      {
        createMissingOrders: true,
        skipStockDeduction: true,
      },
    );

    expect(result.errors).toHaveLength(0);
    expect(result.imported).toBe(1);
    expect(orderItemsRepository.save).toHaveBeenCalled();
    const savedItem = orderItemsRepository.save.mock.calls[0][0];
    expect(savedItem.unitPrice).toBe(0);
    const createdOrder = ordersRepository.save.mock.calls[0][0];
    expect(createdOrder.status).toBe(OrderStatus.COMPLETED);
  });

  it('returns a browser-accessible error file path when import errors are generated', async () => {
    const ordersRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      create: jest.fn((data) => data),
      save: jest.fn(async (order) => ({ ...order, id: 'order-1' })),
    };

    const orderItemsRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (item) => item),
    };

    const customersRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const userBranchRoleRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };

    const productsRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'product-1' }),
    };

    const inventoryService = { deductStock: jest.fn() };
    const notificationsService = { sendNotificationToUser: jest.fn() };

    const service = new OrdersService(
      ordersRepository as any,
      orderItemsRepository as any,
      customersRepository as any,
      userBranchRoleRepository as any,
      productsRepository as any,
      inventoryService as any,
      notificationsService as any,
    );

    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Mã đơn', 'Mã hàng', 'Số lượng'],
      ['', 'SKU-1', '1'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    const buffer = xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    const result = await service.importOrderDetailsFromExcel(
      buffer,
      'branch-1',
      'user-1',
      {
        createMissingOrders: true,
        skipStockDeduction: true,
      },
    );

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errorFile).toContain('/uploads/orders/');
  });
});
