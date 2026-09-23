/**
 * Parser danh rieng cho file Excel "DanhSachChiTietNhapHang" xuat tu phan mem KiotViet.
 *
 * Cau truc file (hang dau tien la header):
 *   Chi nhanh | Ma nhap hang | Thoi gian | Thoi gian tao | Ngay cap nhat |
 *   Ma nha cung cap | Ten nha cung cap | Dien thoai | Dia chi |
 *   Nguoi nhap | Nguoi tao | Tong tien hang | Giam gia phieu nhap |
 *   Can tra NCC | Tien da tra NCC | Ghi chu | So hoa don dau vao |
 *   Tong so luong | Tong so mat hang | Trang thai |
 *   Ma hang | Ma vach | Ten hang | Thuong hieu | DVT | Serial/IMEI | Ghi chu hang hoa |
 *   Don gia | Giam gia % | Giam gia | Gia nhap | Thanh tien | So luong
 */

export interface KiotVietImportValidationError {
  field: string;
  reason: string;
}

export interface KiotVietImportParsedRow {
  // Thong tin phieu nhap
  branchName: string | null;
  invoiceCode: string | null;
  importDate: Date;
  supplierCode: string | null;
  supplierName: string | null;
  supplierPhone: string | null;
  supplierAddress: string | null;
  personnelName: string | null;
  inputInvoice: string | null;
  status: string | null;
  note: string | null;
  totalOrderAmount: number;

  // Thong tin san pham
  productCode: string | null;
  barcode: string | null;
  productName: string | null;
  brand: string | null;
  unit: string | null;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  importPrice: number;
  lineTotal: number;
  quantity: number;

  errors: KiotVietImportValidationError[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeKey = (value: unknown): string => {
  if (value === undefined || value === null) return ``;
  return String(value)
    .trim()
    .toLowerCase()
    .normalize(`NFKD`)
    .replace(/[\u0300-\u036f]/g, ``)
    .replace(/\s+/g, ``)
    .replace(/[^a-z0-9]/g, ``);
};

const findValue = (
  row: Record<string, unknown>,
  candidates: string[],
): string | null => {
  const normalizedRow: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    normalizedRow[normalizeKey(key)] = row[key];
  }
  for (const candidate of candidates) {
    const value = normalizedRow[normalizeKey(candidate)];
    if (value !== undefined && value !== null && String(value).trim() !== ``) {
      return String(value).trim();
    }
  }
  return null;
};

const toNumber = (value: unknown): number => {
  if (value === undefined || value === null) return 0;
  const text = String(value)
    .replace(/\s+/g, ``)
    .replace(/,/g, `.`)
    .replace(/[^0-9.-]/g, ``);
  if (!text) return 0;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Chuyen doi serial number ngay cua Excel (so thuc) sang Date.
 */
const parseExcelDate = (value: unknown): Date => {
  if (value === undefined || value === null || value === ``) return new Date();
  const num = Number(value);
  if (!Number.isNaN(num) && num > 1000) {
    // Excel epoch: Jan 0, 1900 (= Dec 30, 1899)
    const excelEpoch = new Date(1899, 11, 30);
    const dayMs = Math.floor(num) * 86400000;
    const timeMs = Math.round((num - Math.floor(num)) * 24 * 60 * 60 * 1000);
    return new Date(excelEpoch.getTime() + dayMs + timeMs);
  }
  const parsed = new Date(String(value));
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse mot dong du lieu tu file DanhSachChiTietNhapHang (KiotViet).
 */
export function parseKiotVietImportRow(
  row: Record<string, unknown>,
): KiotVietImportParsedRow {
  const errors: KiotVietImportValidationError[] = [];

  // --- Thong tin phieu nhap ---
  const branchName = findValue(row, [`chinhanh`, `chi nhanh`, `branch`]);
  const invoiceCode = findValue(row, [
    `manhaphang`, `ma nhap hang`, `manhap`, `ma nhap`,
    `madon`, `ma don`, `invoicecode`, `invoice_code`,
  ]);

  const importDateRaw = findValue(row, [
    `thoigian`, `thoi gian`, `ngaynhap`, `ngay nhap`,
    `importdate`, `import_date`, `date`, `time`,
  ]);
  const importDate = parseExcelDate(importDateRaw);

  const supplierCode = findValue(row, [
    `manhacungcap`, `ma nha cung cap`, `mancc`, `ma ncc`, `suppliercode`,
  ]);
  const supplierName = findValue(row, [
    `tennhacungcap`, `ten nha cung cap`, `tenncc`, `ten ncc`, `suppliername`,
  ]);
  const supplierPhone = findValue(row, [
    `dienthoai`, `dien thoai`, `sdt`, `phone`,
  ]);
  const supplierAddress = findValue(row, [
    `diachi`, `dia chi`, `address`,
  ]);
  const personnelName =
    findValue(row, [
      `nguoinhap`, `nguoi nhap`, `nhanvien`, `nhan vien`,
      `personnel`, `personnel_name`, `nguoitao`, `nguoi tao`,
    ]) || `KiotViet Import`;
  const inputInvoice = findValue(row, [
    `sohoadondauvao`, `so hoa don dau vao`, `inputinvoice`, `sohoadon`,
  ]);
  const status = findValue(row, [`trangthai`, `trang thai`, `status`]);
  const note = findValue(row, [`ghichu`, `ghi chu`, `note`]);
  const totalOrderAmount = toNumber(
    findValue(row, [`tongtienhang`, `tong tien hang`, `totalamount`, `tongcong`]),
  );

  // --- Thong tin san pham ---
  const productCode = findValue(row, [
    `mahang`, `ma hang`, `productcode`, `masp`, `ma san pham`, `sku`,
  ]);
  const barcode = findValue(row, [
    `mavach`, `ma vach`, `barcode`, `ean`, `upc`,
  ]);
  const productName = findValue(row, [
    `tenhang`, `ten hang`, `productname`, `name`, `ten`,
  ]);
  const brand = findValue(row, [
    `thuonghieu`, `thuong hieu`, `brand`, `manufacturer`,
  ]);
  const unit = findValue(row, [`dvt`, `don vi tinh`, `unit`]);
  const unitPrice = toNumber(findValue(row, [`dongia`, `don gia`, `unitprice`, `price`]));
  const discountPercent = toNumber(findValue(row, [`giamgiaphan`, `giam gia %`, `discountpercent`, `discount_percent`]));
  const discountAmount = toNumber(findValue(row, [`giamgia`, `giam gia`, `discountamount`, `discount`]));
  const importPrice = toNumber(findValue(row, [`gianhap`, `gia nhap`, `importprice`, `costprice`, `giavon`]));
  const lineTotal = toNumber(findValue(row, [`thanhtien`, `thanh tien`, `linetotal`, `total`]));
  const quantity = toNumber(findValue(row, [`soluong`, `so luong`, `quantity`, `qty`]));

  // --- Validation ---
  const productIdentifier = productCode || barcode;
  if (!productIdentifier) {
    errors.push({
      field: `productCode`,
      reason: `Ma hang hoac Ma vach khong duoc de trong`,
    });
  }
  if (!productName) {
    errors.push({
      field: `productName`,
      reason: `Ten hang khong duoc de trong`,
    });
  }
  if (quantity <= 0) {
    errors.push({ field: `quantity`, reason: `So luong phai lon hon 0` });
  }

  // Gia nhap hieu qua
  let effectiveImportPrice = importPrice;
  if (effectiveImportPrice === 0 && lineTotal > 0 && quantity > 0) {
    effectiveImportPrice = lineTotal / quantity;
  }
  if (effectiveImportPrice === 0 && unitPrice > 0) {
    effectiveImportPrice = unitPrice - discountAmount;
  }

  return {
    branchName,
    invoiceCode,
    importDate,
    supplierCode,
    supplierName,
    supplierPhone,
    supplierAddress,
    personnelName,
    inputInvoice,
    status,
    note,
    totalOrderAmount,
    productCode: productCode || null,
    barcode: barcode || null,
    productName: productName || null,
    brand: brand || null,
    unit: unit || null,
    unitPrice,
    discountPercent,
    discountAmount,
    importPrice: effectiveImportPrice,
    lineTotal,
    quantity,
    errors,
  };
}
