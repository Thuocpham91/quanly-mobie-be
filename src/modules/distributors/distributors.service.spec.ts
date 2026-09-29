import { DistributorsService } from './distributors.service';

describe('DistributorsService', () => {
  it('searches distributor codes and preserves pagination metadata', async () => {
    const distributor = { id: 'distributor-1', name: 'Công ty ABC', code: 'NCC-001' };
    const repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[distributor], 21]),
      remove: jest.fn(),
    };
    const service = new DistributorsService(repository as any);

    const result = await service.findAll(2, 10, 'NCC-001');

    const options = repository.findAndCount.mock.calls[0][0];
    expect(options.where).toHaveLength(4);
    expect(options.where[1].code._value).toBe('%NCC-001%');
    expect(options.skip).toBe(10);
    expect(options.take).toBe(10);
    expect(result).toEqual({
      data: [distributor],
      meta: { total: 21, page: 2, limit: 10, totalPages: 3 },
    });
  });
});