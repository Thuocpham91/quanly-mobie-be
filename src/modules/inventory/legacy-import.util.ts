export interface LegacyImportValidationError {
  field: string;
  reason: string;
}

export interface LegacyImportParsedRow {
  productIdentifier: string | null;
  productName?: string | null;
  quantity: number | null;
  costPrice: number;
  importDate: Date;
  invoiceName: string;
  personnelName: string;
  distributorIdentifier?: string | null;
  distributorCode?: string | null;
  distributorName?: string | null;
  distributorPhone?: string | null;
  distributorAddress?: string | null;
  errors: LegacyImportValidationError[];
}

const normalizeKey = (value: unknown) => {
  if (value === undefined || value === null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
};

const findValue = (row: Record<string, unknown>, candidates: string[]) => {
  const normalizedRow: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    normalizedRow[normalizeKey(key)] = row[key];
  }

  for (const candidate of candidates) {
    const value = normalizedRow[normalizeKey(candidate)];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
};

const toNumber = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  const text = String(value)
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseLegacyImportRow(
  row: Record<string, unknown>,
): LegacyImportParsedRow {
  const errors: LegacyImportValidationError[] = [];

  const productIdentifier = findValue(row, [
    'productcode',
    'product_code',
    'masanpham',
    'mãhàng',
    'mahang',
    'barcode',
    'code',
    'sku',
    'productid',
    'product',
    'tenhang',
    'tênhàng',
  ]);
  const quantityRaw = findValue(row, ['quantity', 'soluong', 'sốlượng', 'qty']);
  const unitPriceRaw = findValue(row, [
    'costprice',
    'cost_price',
    'giavon',
    'giávốn',
    'cost',
    'dongia',
    'đơngiá',
    'don gia',
  ]);
  const totalAmountRaw = findValue(row, [
    'thanhtien',
    'thành tiền',
    'total',
    'tongtien',
    'tổng tiền',
  ]);
  const importDateRaw = findValue(row, [
    'importdate',
    'ngaynhap',
    'ngày nhập',
    'import_date',
    'date',
  ]);
  const invoiceName = findValue(row, [
    'invoice',
    'invoice_name',
    'hóađơn',
    'hoáđơn',
    'invoicename',
    'sohoadon',
    'số hóa đơn',
    'sốhóađơn',
    'mã hóa đơn',
    'mãhóađơn',
    'mahoadon',
    'ma hoadon',
    'mã hđ',
    'mahdoan',
    'mãhd',
    'mahd',
    'mã nhập hàng',
    'manhaphang',
    'mãnhậphàng',
    'mã phiếu nhập',
    'maphieunhap',
    'mãphiếunhập',
    'mã đơn nhập',
    'madonnhap',
    'mãđơnnhập',
    'mã đơn',
    'madon',
    'mãđơn',
    'mã phiếu',
    'maphieu',
    'mãphiếu',
    'mã nhập',
    'manhap',
    'mãnhập',
    'mã nhập kho',
    'manhapkho',
    'mãnhậpkho',
    'mã chứng từ',
    'machungtu',
    'mãchứngtừ',
    'số chứng từ',
    'sochungtu',
    'sốchứngtừ',
  ]) || '';
  const personnelName = findValue(row, [
    'personnel',
    'personnel_name',
    'nhânviên',
    'nhanvien',
    'nguoinhap',
  ]) || 'Legacy Import';
  const distributorIdentifier = findValue(row, [
    'distributor',
    'distributor_code',
    'nhacungcap',
    'nha cung cap',
    'nha cungcap',
    'ncc',
    'manhacungcap',
    'mãnhàcungcấp',
    'mã nhà cung cấp',
    'ma nha cung cap',
    'nhacungcapcode',
  ]);
  // Additional distributor fields commonly present in legacy files
  const distributorCode = findValue(row, [
    'mãnhàcungcấp',
    'mã nhà cung cấp',
    'mancc',
    'manhacungcap',
    'ma ncc',
    'manhacungcapcode',
    'macc',
  ]);
  const distributorName = findValue(row, ['tênnhacungcap', 'tên nhà cung cấp', 'ten nha cung cap', 'tên nhà cung cấp', 'tên nhà phân phối', 'tên nhàpp', 'tenncc']);
  const distributorPhone = findValue(row, ['điện thoại', 'dienthoai', 'sđt', 'sdt', 'phone', 'phone_number']);
  const distributorAddress = findValue(row, ['địa chỉ', 'diachi', 'address', 'addr']);
  const productName = findValue(row, ['productname', 'tênhàng', 'tên hàng', 'name', 'tên', 'tenhang']);

  const quantity = toNumber(quantityRaw);
  const costPrice = toNumber(unitPriceRaw);
  const importDate = importDateRaw ? new Date(importDateRaw) : new Date();

  if (!productIdentifier) {
    errors.push({
      field: 'productIdentifier',
      reason: 'Mã sản phẩm / mã hàng không được để trống',
    });
  }

  if (quantity === null || quantity <= 0) {
    errors.push({ field: 'quantity', reason: 'Số lượng phải lớn hơn 0' });
  }

  const normalizedCost = costPrice ?? 0;
  let effectiveCost = normalizedCost;
  if (
    (costPrice === null || costPrice === 0) &&
    quantity !== null &&
    quantity > 0
  ) {
    const totalAmount = toNumber(totalAmountRaw);
    if (totalAmount !== null && totalAmount > 0) {
      effectiveCost = totalAmount / quantity;
    }
  }

  return {
    productIdentifier: productIdentifier || null,
    productName: productName || null,
    quantity: quantity ?? null,
    costPrice: effectiveCost,
    importDate,
    invoiceName,
    personnelName,
    distributorIdentifier: distributorIdentifier || null,
    distributorCode: distributorCode || null,
    distributorName: distributorName || null,
    distributorPhone: distributorPhone || null,
    distributorAddress: distributorAddress || null,
    errors,
  };
}
