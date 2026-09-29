import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';
import { InventoryLog, StockMovementType } from '../inventory/entities/inventory-log.entity';
import { InventoryOrder, ImportOrderStatus } from '../inventory/entities/inventory-order.entity';
import { Distributor } from '../distributors/entities/distributor.entity';
import { Product } from './entities/product.entity';
import { ProductUnit } from './entities/product-unit.entity';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { parseBoolean, parseNumber } from './parse-number.util';
import { findValue, normalizeHeader } from './excel-row.util';


@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(InventoryBatch)
    private inventoryRepository: Repository<InventoryBatch>,
    @InjectRepository(InventoryLog)
    private inventoryLogRepository: Repository<InventoryLog>,
    @InjectRepository(InventoryOrder)
    private importOrderRepository: Repository<InventoryOrder>,
    @InjectRepository(Distributor) 
    private distributorRepository: Repository<Distributor>,
  ) {}

  async findAll(isService?: boolean, page = 1, limit = 10, search?: string): Promise<PaginatedResult<Product>> {
    const whereClause: any = {};
    if (isService !== undefined) {
      whereClause.isService = isService;
    }

    const searchTerm = search?.trim();
    const where = searchTerm
      ? [
          { ...whereClause, name: ILike(`%${searchTerm}%`) },
          { ...whereClause, productCode: ILike(`%${searchTerm}%`) },
          { ...whereClause, barcode: ILike(`%${searchTerm}%`) },
          { ...whereClause, manufacturer: ILike(`%${searchTerm}%`) },
        ]
      : whereClause;

    const relations = ['category', 'itemGroup', 'classification', 'unit', 'units', 'units.unit', 'branchPrices', 'branchPrices.branch'];

    const pageNumber = Math.max(1, page);
    const [data, total] = await this.productsRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      relations,
      skip: (pageNumber - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page: pageNumber,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({ 
      where: { id },
      relations: [
        'category',
        'itemGroup',
        'classification',
        'unit',
        'units',
        'units.unit',
        'branchPrices',
        'branchPrices.branch',
        'batches',
        'batches.distributor',
        'batches.importOrder',
        'batches.importOrder.distributor',
        'batches.branch',
      ],
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    if (createProductDto.imageUrls && createProductDto.imageUrls.length > 0) {
      if (!createProductDto.imageUrl) {
        createProductDto.imageUrl = createProductDto.imageUrls[0];
      }
    } else if (createProductDto.imageUrl) {
      createProductDto.imageUrls = [createProductDto.imageUrl];
    }

    const product = this.productsRepository.create(createProductDto);
    return this.productsRepository.save(product);
  }

  async importFromExcel(fileBuffer: Buffer, branchId?: string, userId?: string): Promise<{ success: number; failed: any[] }> {
    if (!fileBuffer) {
      throw new BadRequestException('Vui lòng tải lên tệp tin Excel');
    }
    if (!branchId) {
      throw new BadRequestException('Vui lòng chọn chi nhánh trước khi import sản phẩm');
    }

    const now = new Date();

    // Helper: lấy giá trị RAW (không ép string) từ row Excel, dùng cho cột date
    const findRawValue = (row: Record<string, any>, keys: string[]): any => {
      const normalizedKeys = keys.map(k => normalizeHeader(k));
      const headers = Object.keys(row);
      const exactKey = headers.find(h => normalizedKeys.includes(normalizeHeader(h)));
      const foundKey = exactKey || headers.find(h => {
        const nh = normalizeHeader(h);
        return normalizedKeys.some(sk => sk.length >= 4 && nh.includes(sk));
      });
      return foundKey !== undefined ? row[foundKey] : undefined;
    };

    // Helper: parse giá trị cột "Thời gian tạo" thành Date
    const parseImportDate = (raw: any): Date => {
      if (raw === null || raw === undefined || raw === '') return now;
      // Nếu đã là Date object (xlsx có thể parse sẵn khi cellDates:true)
      if (raw instanceof Date) {
        return isNaN(raw.getTime()) ? now : raw;
      }
      // Excel numeric serial date (number hoặc string số)
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (!isNaN(num) && num > 1) {
        // xlsx serial: days since 1899-12-30
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const date = new Date(excelEpoch.getTime() + num * 86400000);
        if (!isNaN(date.getTime())) return date;
      }
      // String date
      const str = String(raw).trim();
      if (!str) return now;
      // Try DD/MM/YYYY HH:mm:ss or DD/MM/YYYY
      const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[\s,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      if (ddmmyyyy) {
        const [, d, m, y, hh = '0', mm = '0', ss = '0'] = ddmmyyyy;
        const parsed = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${hh.padStart(2,'0')}:${mm}:${ss.padStart(2,'0')}`);
        if (!isNaN(parsed.getTime())) return parsed;
      }
      // Fallback: native Date parse
      const fallback = new Date(str);
      return isNaN(fallback.getTime()) ? now : fallback;
    };

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const importOrdersByCode = new Map<string, InventoryOrder>();
    const orderSummariesCaptured = new Set<string>();
    const fallbackImportOrderCode = `PRD-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 100000)}`;

    const failed: any[] = [];
    let success = 0;

    for (const [index, row] of rows.entries()) {
      try {
        const name = findValue(row, [
          'tên hàng',
          'ten hang',
          'tên sản phẩm',
          'ten san pham',
          'product name',
          'name',
        ]);
        const productCode = findValue(row, [
          'mã hàng',
          'ma hang',
          'mã sản phẩm',
          'ma san pham',
          'product code',
          'sku',
        ]);
        const barcode = findValue(row, [
          'mã vạch',
          'ma vach',
          'barcode',
        ]);
        const sourceImportCode = findValue(row, [
          'mã nhập hàng',
          'ma nhap hang',
          'mã phiếu nhập',
          'ma phieu nhap',
          'mã đơn nhập',
          'ma don nhap',
          'import code',
          'importcode',
          'invoice code',
          'invoicecode',
        ]);
        const supplierCode = findValue(row, [
          'mã ncc',
          'ma ncc',
          'mã nhà cung cấp',
          'ma nha cung cap',
          'supplier code',
          'suppliercode',
          'mã npp',
          'ma npp',
        ]);
        const supplierName = findValue(row, [
          'tên nhà cung cấp',
          'ten nha cung cap',
          'tên ncc',
          'ten ncc',
          'supplier name',
          'suppliername',
        ]);
        const supplierPhone = findValue(row, [
          'điện thoại',
          'dien thoai',
          'số điện thoại',
          'so dien thoai',
          'phone',
        ]);
        const serialValue = findValue(row, [
          'serial/imei',
          'serial imei',
          'serial',
          'imei',
        ]);
        const imeis = serialValue
          ? serialValue.split(/[,;\n|]+/).map((serial) => serial.trim()).filter(Boolean)
          : undefined;
        const manufacturer = findValue(row, [
          'nhà sản xuất',
          'nha san xuat',
          'thương hiệu',
          'thuong hieu',
          'manufacturer',
          'brand',
        ]);
        const unitPrice = parseNumber(findValue(row, [
          'đơn giá',
          'don gia',
          'unit price',
        ]));
        const discountPercent = parseNumber(findValue(row, [
          'giảm giá %',
          'giam gia %',
          'discount percent',
        ]));
        const discountAmount = parseNumber(findValue(row, [
          'giảm giá',
          'giam gia',
          'discount amount',
        ]));
        const invoiceNumber = findValue(row, [
          'số hóa đơn',
          'so hoa don',
          'số hóa đơn đầu vào',
          'so hoa don dau vao',
          'invoice number',
        ]);
        const importPrice = parseNumber(findValue(row, [
          'giá nhập',
          'gia nhap',
          'giá vốn',
          'gia von',
          'import price',
          'cost price',
        ]));
        const quantity = parseNumber(findValue(row, [
          'số lượng',
          'so luong',
          'quantity',
          'số lượng',
          'qty',
        ]));

        // Đọc cột "Thời gian tạo" để dùng làm ngày nhập (dùng findRawValue để giữ kiểu Date/number gốc)
        const rawImportDate = findRawValue(row, [
          'thời gian tạo',
          'thoi gian tao',
          'ngày tạo',
          'ngay tao',
          'ngày nhập',
          'ngay nhap',
          'import date',
          'importdate',
          'created at',
          'createdat',
          'date',
        ]);
        const rowImportDate = parseImportDate(rawImportDate);
        console.log(`[ImportExcel] row ${index + 2} rawImportDate=`, rawImportDate, '=> rowImportDate=', rowImportDate);

        const orderTotalQuantityValue = findValue(row, [
          'tổng số lượng',
          'tong so luong',
          'total quantity',
          'tổng số lượng',
        ]);
        const orderTotalQuantity = parseNumber(orderTotalQuantityValue);

        const orderTotalItemCountValue = findValue(row, [
          'tổng số mặt hàng',
          'tong so mat hang',
          'total item count',
          'total items',
        ]);
        const orderTotalItemCount = parseNumber(orderTotalItemCountValue);

        const orderTotalProductAmountValue = findValue(row, [
          'tổng tiền hàng',
          'tong tien hang',
          'total amount',
          'total product amount',
        ]);
        const orderTotalProductAmount = parseNumber(orderTotalProductAmountValue);
        const lineTotal = parseNumber(findValue(row, [
          'thành tiền',
          'thanh tien',
          'line total',
        ]));
        const orderDiscountAmountValue = findValue(row, [
          'giảm giá phiếu',
          'giam gia phieu',
          'giảm giá phiếu nhập',
          'giam gia phieu nhap',
          'discount order amount',
        ]);
        const orderDiscountAmount = parseNumber(orderDiscountAmountValue);
        const note = findValue(row, [
          'ghi chú',
          'ghi chu',
          'ghi chú',
          'note',
        ]);
        const status = findValue(row, [
          'trạng thái',
          'trang thai',
          'trạng thái',
          'status',
        ]);
        const orderDebtAmountValue = findValue(row, [
          'cần trả ncc',
          'can tra ncc',
          'cần trả ncc',
          'cần trả nhà cung cấp',
          'debt amount',
        ]);
        const orderDebtAmount = parseNumber(orderDebtAmountValue);
        const orderPaidAmountValue = findValue(row, [
          'tiền đã trả ncc',
          'tien da tra ncc',
          'tiền đã trả ncc',
          'tiền đã trả nhà cung cấp',
          'paid amount',
        ]);
        const orderPaidAmount = parseNumber(orderPaidAmountValue);
        const isService = parseBoolean(findValue(row, [
          'dịch vụ',
          'dich vu',
          'service',
          'is service',
          'hàng dịch vụ',
          'hang dich vu',
          'dichvu',
        ]));
        const imageUrl = findValue(row, [
          'ảnh',
          'hinh anh',
          'hình ảnh',
          'image',
          'image url',
        ]);

        if (!name) {
          throw new Error('Tên sản phẩm không được để trống');
        }

        const payload: Partial<Product> = {
          name,
          productCode: productCode || undefined,
          barcode: barcode || undefined,
          imeis: imeis?.length ? imeis : undefined,
          manufacturer: manufacturer || undefined,
          basePrice: importPrice || 0,
          importPrice: importPrice || 0,
          quantity: quantity || 0,
          note: note || undefined,
          status: status || undefined,
          isService,
          imageUrl: imageUrl || undefined,
        };

        let existingProduct: Product | null = null;

        if (productCode) {
          existingProduct = await this.productsRepository.findOne({ where: { productCode } });
        }

    

        let finalProduct: Product;
        
        if (existingProduct) {
          const currentQty = Number(existingProduct.quantity) || 0;
          const incomingQty = Number(quantity) || 0;
          const accumulatedQty = currentQty + incomingQty;

          const updatePayload: Partial<Product> = {
            ...payload,
            quantity: accumulatedQty,
            imeis: imeis?.length
              ? [...new Set([...(existingProduct.imeis || []), ...imeis])]
              : existingProduct.imeis,
            importPrice: importPrice > 0 ? importPrice : existingProduct.importPrice,
            basePrice: importPrice > 0 ? importPrice : existingProduct.basePrice,
            manufacturer: manufacturer || existingProduct.manufacturer,
            status: status || existingProduct.status,
            note: note || existingProduct.note,
            imageUrl: imageUrl || existingProduct.imageUrl,
            ...(productCode ? { productCode } : {}),
            ...(barcode ? { barcode } : {}),
          };
          await this.productsRepository.update(existingProduct.id, updatePayload);
          finalProduct = { ...existingProduct, ...updatePayload } as Product;
        } else {
          const product = this.productsRepository.create(payload);
          finalProduct = await this.productsRepository.save(product);
        }

        // ---- Tim hoac tao moi Nha phan phoi ----
        let distributor: Distributor | null = null;
        if (supplierCode || supplierName || supplierPhone || manufacturer) {
          const whereClauses: any[] = [];
          if (supplierCode) whereClauses.push({ code: supplierCode });
          if (supplierName) whereClauses.push({ name: supplierName });
          if (supplierPhone) whereClauses.push({ phone: supplierPhone });
          if (manufacturer) whereClauses.push({ name: manufacturer });

          if (whereClauses.length > 0) {
            distributor = (await this.distributorRepository.findOne({ where: whereClauses })) as Distributor | null;
          }

          if (distributor) {
            let distributorChanged = false;
            if (
              supplierName &&
              distributor.code === supplierCode &&
              distributor.name === supplierCode
            ) {
              distributor.name = supplierName;
              distributorChanged = true;
            }
            if (supplierPhone && !distributor.phone) {
              distributor.phone = supplierPhone;
              distributorChanged = true;
            }
            if (distributorChanged) {
              distributor = await this.distributorRepository.save(distributor);
            }
          }

          if (!distributor) {
            const newDist = this.distributorRepository.create({
              code: supplierCode || undefined,
              name: supplierName || manufacturer || supplierCode || 'Nhà cung cấp mới',
              phone: supplierPhone || undefined,
            });
            distributor = await this.distributorRepository.save(newDist);
          }
        }

        const effectiveQuantity = quantity || 0;
        const effectivePrice = importPrice || unitPrice || 0;
        const effectiveUnitPrice = unitPrice || effectivePrice;
        const effectiveLineTotal = lineTotal || (effectiveQuantity * effectivePrice);

        const orderCode = sourceImportCode || fallbackImportOrderCode;
        const mapKey = `${branchId}:${orderCode.toLowerCase()}`;

        let savedImportOrder = importOrdersByCode.get(mapKey);
        if (!savedImportOrder) {
          savedImportOrder = (await this.importOrderRepository.findOne({
            where: [
              { code: orderCode, branchId },
              { invoiceName: orderCode, branchId },
              { invoiceNumber: orderCode, branchId },
            ],
          })) || undefined;

          if (!savedImportOrder) {
            const existingCode = await this.importOrderRepository.findOne({
              where: { code: orderCode },
            });
            const uniqueCode = existingCode
              ? `${orderCode}-${branchId.slice(0, 8)}`
              : orderCode;
            const newImportOrder = this.importOrderRepository.create({
              code: uniqueCode,
              branchId,
              distributorId: distributor?.id || undefined,
              invoiceName: orderCode,
              invoiceNumber: invoiceNumber || undefined,
              personnelName: 'Hệ thống (Import chi tiết nhập hàng sản phẩm)',
              importDate: rowImportDate,
              createdById: userId,
              totalAmount: 0,
              totalProductAmount: 0,
              totalQuantity: 0,
              totalItemCount: 0,
              discountPercent: 0,
              debtAmount: 0,
              paidAmount: 0,
              discountAmount: 0,
              status: ImportOrderStatus.COMPLETED,
            });
            savedImportOrder = (await this.importOrderRepository.save(newImportOrder)) as InventoryOrder;
          }

          importOrdersByCode.set(mapKey, savedImportOrder);
        }

        const captureOrderSummary = !orderSummariesCaptured.has(mapKey);
        const orderTotals = {
          totalAmount: orderTotalProductAmountValue !== ''
            ? orderTotalProductAmount - (orderDiscountAmountValue !== '' ? orderDiscountAmount : 0)
            : Number(savedImportOrder.totalAmount || 0) + effectiveLineTotal,
          ...(captureOrderSummary
            ? {
                totalProductAmount: orderTotalProductAmountValue !== ''
                  ? orderTotalProductAmount
                  : effectiveLineTotal,
                totalQuantity: orderTotalQuantityValue !== ''
                  ? orderTotalQuantity
                  : effectiveQuantity,
                totalItemCount: orderTotalItemCountValue !== ''
                  ? orderTotalItemCount
                  : 1,
                debtAmount: orderDebtAmountValue !== ''
                  ? orderDebtAmount
                  : Number(savedImportOrder.debtAmount || 0),
                paidAmount: orderPaidAmountValue !== ''
                  ? orderPaidAmount
                  : Number(savedImportOrder.paidAmount || 0),
              }
            : {}),
          ...(!savedImportOrder.distributorId && distributor
            ? { distributorId: distributor.id }
            : {}),
          discountPercent,
          discountAmount: orderDiscountAmountValue !== ''
            ? orderDiscountAmount
            : Number(savedImportOrder.discountAmount || 0) + discountAmount,
        };
        await this.importOrderRepository.update(savedImportOrder.id, orderTotals);
        Object.assign(savedImportOrder, orderTotals);
        orderSummariesCaptured.add(mapKey);




        const batch = this.inventoryRepository.create({
          productId: finalProduct.id,
          branchId,
          importedQuantity: effectiveQuantity,
          currentQuantity: effectiveQuantity,
          costPrice: effectivePrice,
          unitPrice: effectiveUnitPrice,
          discountPercent,
          discountAmount,
          imeis,
          lineTotal: effectiveLineTotal,
          importDate: rowImportDate,
          invoiceName: savedImportOrder.invoiceName || savedImportOrder.code,
          personnelName: 'Hệ thống (Import chi tiết nhập hàng sản phẩm)',
          distributorId: distributor?.id || undefined,
          importOrderId: savedImportOrder.id,
          itemNote: note || undefined,
        });
        const savedBatch = await this.inventoryRepository.save(batch);

        await this.inventoryLogRepository.save(this.inventoryLogRepository.create({
          productId: finalProduct.id,
          branchId,
          type: StockMovementType.IMPORT,
          quantity: effectiveQuantity,
          batchId: savedBatch.id,
          referenceCode: savedImportOrder.code,
          note: `Import chi tiết nhập hàng sản phẩm ${finalProduct.name} theo mã ${finalProduct.productCode || finalProduct.barcode || 'không có mã'}`,
          createdById: userId,
        }));

        success += 1;
      } catch (error: any) {
        failed.push({
          row: index + 2,
          reason: error.message || 'Lỗi không xác định',
        });
      }
    }

    return { success, failed };
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);

    if (updateProductDto.imageUrls !== undefined) {
      if (updateProductDto.imageUrls && updateProductDto.imageUrls.length > 0) {
        updateProductDto.imageUrl = updateProductDto.imageUrls[0];
      } else {
        updateProductDto.imageUrl = undefined;
      }
    } else if (updateProductDto.imageUrl) {
      updateProductDto.imageUrls = [updateProductDto.imageUrl];
    }

    // Explicitly handle units to ensure TypeORM syncs them correctly
    const { units, ...rest } = updateProductDto;

    // Merge basic fields
    this.productsRepository.merge(product, rest);

    // If units are provided, update the relationship
    if (units) {
      product.units = units.map(u => {
        const productUnit = new ProductUnit();
        Object.assign(productUnit, u);
        productUnit.productId = id;
        return productUnit;
      });
    }

    return this.productsRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productsRepository.remove(product);
  }

  async getProductImportHistory(
    productId: string,
    branchId?: string,
  ): Promise<Array<InventoryBatch & { supplierName: string | null }>> {
    const where: any = { productId };
    if (branchId && branchId !== 'undefined' && branchId !== 'null') {
      where.branchId = branchId;
    }
    const batches = await this.inventoryRepository.find({
      where,
      relations: [
        'distributor',
        'branch',
        'importOrder',
        'importOrder.distributor',
      ],
      order: { createdAt: 'DESC' },
    });

    return batches.map((batch) => ({
      ...batch,
      supplierName:
        batch.distributor?.name || batch.importOrder?.distributor?.name || null,
    }));
  }
}
