import * as xlsx from 'xlsx';
import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';

describe('OrdersService', () => {
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
