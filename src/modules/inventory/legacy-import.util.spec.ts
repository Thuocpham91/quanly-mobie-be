import { parseLegacyImportRow } from './legacy-import.util';

describe('parseLegacyImportRow', () => {
  it('parses Vietnamese Excel headers and derives cost price from total amount', () => {
    const row = {
      'Mã hàng': '893000111222',
      'Tên hàng': 'Vắc xin dại',
      'Số lượng': 10,
      'Thành tiền': 500000,
      'Hạn sử dụng': '2026-12-31',
      'Hàng tặng (1: Có, 0: Không)': 0,
    };

    const result = parseLegacyImportRow(row);

    expect(result.errors).toEqual([]);
    expect(result.productIdentifier).toBe('893000111222');
    expect(result.quantity).toBe(10);
    expect(result.costPrice).toBe(50000);
    expect(result.importDate).toBeInstanceOf(Date);
  });

  it('returns validation errors for missing product or invalid quantity', () => {
    const row = {
      'Số lượng': 0,
      'Đơn giá': 100000,
    };

    const result = parseLegacyImportRow(row);

    expect(result.productIdentifier).toBeNull();
    expect(result.quantity).toBe(0);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'productIdentifier', reason: expect.stringContaining('không được để trống') }),
        expect.objectContaining({ field: 'quantity', reason: expect.stringContaining('lớn hơn 0') }),
      ]),
    );
  });
});
