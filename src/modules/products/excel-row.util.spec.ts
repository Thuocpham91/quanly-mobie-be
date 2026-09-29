import { findValue } from './excel-row.util';

describe('findValue', () => {
  it('does not partially match unrelated columns with short aliases', () => {
    expect(findValue({ 'Mã nhập hàng': 'NK-001' }, ['ảnh'])).toBe('');
  });

  it('prefers normalized exact headers over partial headers', () => {
    expect(findValue({
      'Mã nhà cung cấp': 'NCC-001',
      'Tên nhà cung cấp': 'Công ty ABC',
    }, ['tên nhà cung cấp', 'nhà cung cấp'])).toBe('Công ty ABC');
  });
});
