import { InventoryService } from './inventory.service';

describe('InventoryService IMEI stock handling', () => {
  it('returns available IMEIs from stock remaining in the branch', async () => {
    const inventoryRepository = {
      find: jest.fn().mockResolvedValue([
        { currentQuantity: 2, imeis: ['IMEI-1', 'IMEI-2', 'IMEI-3'] },
        { currentQuantity: 1, imeis: ['IMEI-4'] },
      ]),
    };
    const service = new InventoryService(
      inventoryRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.getAvailableImeis('product-1', 'branch-1'),
    ).resolves.toEqual(['IMEI-1', 'IMEI-2', 'IMEI-4']);
  });

  it('removes selected IMEI and logs the serialized sale transactionally', async () => {
    const batch = {
      id: 'batch-1',
      productId: 'product-1',
      branchId: 'branch-1',
      currentQuantity: 2,
      imeis: ['IMEI-1', 'IMEI-2'],
    };
    const manager = {
      find: jest.fn().mockResolvedValue([batch]),
      save: jest.fn(async (_entity, value) => value),
    };
    const inventoryRepository = {
      manager: {
        transaction: jest.fn((callback) => callback(manager)),
      },
      find: jest.fn(),
    };
    const inventoryLogRepository = {
      create: jest.fn((log) => log),
    };
    const service = new InventoryService(
      inventoryRepository as any,
      inventoryLogRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.deductStock(
      'product-1',
      'branch-1',
      1,
      'ORD-001',
      'user-1',
      ['IMEI-1'],
    );

    expect(batch.currentQuantity).toBe(1);
    expect(batch.imeis).toEqual(['IMEI-2']);
    expect(inventoryRepository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenNthCalledWith(1, expect.any(Function), batch);
    expect(manager.save).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      expect.objectContaining({
        productId: 'product-1',
        type: 'SALE',
        quantity: -1,
        batchId: 'batch-1',
        referenceCode: 'ORD-001',
        imei: 'IMEI-1',
      }),
    );
  });

  it('rejects an IMEI that is no longer available without changing stock', async () => {
    const batch = {
      id: 'batch-1',
      productId: 'product-1',
      branchId: 'branch-1',
      currentQuantity: 1,
      imeis: ['IMEI-1'],
    };
    const manager = {
      find: jest.fn().mockResolvedValue([batch]),
      save: jest.fn(),
    };
    const inventoryRepository = {
      manager: {
        transaction: jest.fn(async (callback) => callback(manager)),
      },
      find: jest.fn(),
    };
    const service = new InventoryService(
      inventoryRepository as any,
      { create: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.deductStock(
        'product-1',
        'branch-1',
        1,
        'ORD-002',
        'user-1',
        ['IMEI-SOLD'],
      ),
    ).rejects.toThrow('IMEI IMEI-SOLD is no longer available');
    expect(batch.currentQuantity).toBe(1);
    expect(batch.imeis).toEqual(['IMEI-1']);
    expect(manager.save).not.toHaveBeenCalled();
  });
});
