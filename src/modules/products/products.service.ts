import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';
import { InventoryLog, StockMovementType } from '../inventory/entities/inventory-log.entity';
import { InventoryImportOrder, ImportOrderStatus } from '../inventory/entities/inventory-import-order.entity';
import { Product } from './entities/product.entity';
import { ProductUnit } from './entities/product-unit.entity';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';


@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(InventoryBatch)
    private inventoryRepository: Repository<InventoryBatch>,
    @InjectRepository(InventoryLog)
    private inventoryLogRepository: Repository<InventoryLog>,
    @InjectRepository(InventoryImportOrder)
    private importOrderRepository: Repository<InventoryImportOrder>,
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
      relations: ['category', 'itemGroup', 'classification', 'unit', 'units', 'units.unit', 'branchPrices', 'branchPrices.branch']
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
    const importOrderCode = `PRD-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 100000)}`;
    const importOrder = this.importOrderRepository.create({
      code: importOrderCode,
      branchId,
      invoiceName: `PRODUCT_IMPORT_${now.toISOString().slice(0, 10)}`,
      personnelName: 'Hệ thống (Import sản phẩm)',
      importDate: now,
      createdById: userId,
      totalAmount: 0,
      status: ImportOrderStatus.COMPLETED,
    });
    const savedImportOrder = await this.importOrderRepository.save(importOrder);

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const findValue = (row: any, keys: string[]) => {
      const foundKey = Object.keys(row).find((key) => {
        const normalized = String(key ?? '').trim().toLowerCase();
        return keys.some((searchKey) => normalized.includes(searchKey.toLowerCase()));
      });
      return foundKey ? String(row[foundKey] ?? '').trim() : '';
    };

    const parseNumber = (value: any): number => {
      if (value === null || value === undefined || value === '') {
        return 0;
      }

      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
      }

      let str = String(value).trim();
      if (!str) {
        return 0;
      }

      str = str.replace(/[₫$VNĐvnd]/gi, '').trim();
      if ((str.match(/\./g) || []).length > 1) {
        str = str.replace(/\./g, '');
      }
      if ((str.match(/,/g) || []).length > 1) {
        str = str.replace(/,/g, '');
      }

      if (str.includes(',') && str.includes('.')) {
        const commaIndex = str.indexOf(',');
        const dotIndex = str.indexOf('.');
        if (commaIndex > dotIndex) {
          str = str.replace(/\./g, '').replace(/,/g, '.');
        } else {
          str = str.replace(/,/g, '');
        }
      } else if (str.includes(',')) {
        const parts = str.split(',');
        if (parts.length === 2 && parts[1].length === 3) {
          str = str.replace(/,/g, '');
        } else {
          str = str.replace(/,/g, '.');
        }
      } else if (str.includes('.')) {
        const parts = str.split('.');
        if (parts.length === 2 && parts[1].length === 3) {
          str = str.replace(/\./g, '');
        }
      }

      const parsed = Number(str);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const parseBoolean = (value: any): boolean => {
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'number') {
        return value !== 0;
      }
      const normalized = String(value ?? '').trim().toLowerCase();
      return ['true', '1', 'yes', 'y', 'x', 'dich vu', 'dịch vụ'].includes(normalized);
    };

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
          'sản phẩm',
          'san pham',
          'ten sanpham',
          'tenhang',
        ]);
        const productCode = findValue(row, [
          'mã hàng',
          'ma hang',
          'mã sản phẩm',
          'ma san pham',
          'product code',
          'productcode',
          'mã sp',
          'ma sp',
          'sku',
          'code',
          'itemcode',
          'item code',
        ]);
        const barcode = findValue(row, [
          'mã vạch',
          'ma vach',
          'barcode',
          'ean',
          'upc',
          'ma vach san pham',
        ]);
        const manufacturer = findValue(row, [
          'nhà sản xuất',
          'nha san xuat',
          'manufacturer',
          'thương hiệu',
          'thuong hieu',
          'brand',
          'hãng',
          'hang',
          'nha cung cap',
          'nhà cung cấp',
          'supplier',
        ]);
        const importPrice = parseNumber(findValue(row, [
          'giá nhập',
          'gia nhap',
          'import price',
          'importprice',
          'cost price',
          'costprice',
          'giá vốn',
          'gia von',
          'base price',
        ]));
        const basePrice = parseNumber(findValue(row, [
          'giá gốc',
          'gia goc',
          'giá vốn',
          'gia von',
          'giá nhập',
          'gia nhap',
          'base price',
          'cost price',
          'costprice',
          'don gia',
          'đơn giá',
          'dongia',
          'price',
          'giá',
          'gia',
        ]));
        const quantity = parseNumber(findValue(row, [
          'so luong',
          'số lượng',
          'soluong',
          'quantity',
          'qty',
          'tong so',
          'tổng số',
        ]));
        const totalAmount = parseNumber(findValue(row, [
          'thanhtien',
          'thành tiền',
          'tong tien hang',
          'tổng tiền hàng',
          'total amount',
          'total',
        ]));
        const note = findValue(row, [
          'ghi chu',
          'ghi chú',
          'note',
          'comments',
        ]);
        const status = findValue(row, [
          'trang thai',
          'trạng thái',
          'status',
        ]);
        const canTraNcc = parseNumber(findValue(row, [
          'can tra ncc',
          'cần trả ncc',
          'can tra nha cung cap',
          'cần trả nhà cung cấp',
        ]));
        const tienTraNcc = parseNumber(findValue(row, [
          'tien tra ncc',
          'tiền trả ncc',
          'tien tra nha cung cap',
          'tiền trả nhà cung cấp',
        ]));
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
          manufacturer: manufacturer || undefined,
          basePrice: basePrice || importPrice || 0,
          importPrice: importPrice || basePrice || 0,
          quantity: quantity || 0,
          totalAmount: totalAmount || 0,
          canTraNcc: canTraNcc || 0,
          tienTraNcc: tienTraNcc || 0,
          note: note || undefined,
          status: status || undefined,
          isService,
          imageUrl: imageUrl || undefined,
        };

        let existingProduct: Product | null = null;

        if (productCode) {
          existingProduct = await this.productsRepository.findOne({ where: { productCode } });
        }

        if (!existingProduct && barcode) {
          existingProduct = await this.productsRepository.findOne({ where: { barcode } });
        }

        let finalProduct = existingProduct;
        if (existingProduct) {
          const updatePayload: Partial<Product> = {
            ...payload,
            ...(productCode ? { productCode } : {}),
            ...(barcode ? { barcode } : {}),
          };
          await this.productsRepository.update(existingProduct.id, updatePayload);
          finalProduct = { ...existingProduct, ...updatePayload } as Product;
        } else {
          const product = this.productsRepository.create(payload);
          finalProduct = await this.productsRepository.save(product);
        }

        const effectiveQuantity = quantity || 0;
        const effectivePrice = importPrice || basePrice || 0;
        const lineTotal = effectiveQuantity * effectivePrice;

        await this.importOrderRepository.update(savedImportOrder.id, {
          totalAmount: Number((savedImportOrder.totalAmount || 0) + lineTotal),
        });

        const batch = this.inventoryRepository.create({
          productId: finalProduct.id,
          branchId,
          importedQuantity: effectiveQuantity,
          currentQuantity: effectiveQuantity,
          costPrice: effectivePrice,
          importDate: now,
          invoiceName: savedImportOrder.invoiceName || savedImportOrder.code,
          personnelName: 'Hệ thống (Import sản phẩm)',
          importOrderId: savedImportOrder.id,
        });
        const savedBatch = await this.inventoryRepository.save(batch);

        await this.inventoryLogRepository.save(this.inventoryLogRepository.create({
          productId: finalProduct.id,
          branchId,
          type: StockMovementType.IMPORT,
          quantity: effectiveQuantity,
          batchId: savedBatch.id,
          referenceCode: savedImportOrder.code,
          note: `Import sản phẩm ${finalProduct.name} theo mã ${finalProduct.productCode || finalProduct.barcode || 'không có mã'}`,
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
}
