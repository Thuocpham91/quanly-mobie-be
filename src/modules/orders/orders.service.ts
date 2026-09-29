import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { InventoryService } from '../inventory/inventory.service';
import { Customer } from '../customers/entities/customer.entity';
import { UserBranchRole } from '../branches/entities/user-branch-role.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(UserBranchRole)
    private readonly userBranchRoleRepository: Repository<UserBranchRole>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly inventoryService: InventoryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async findProductByIdentifier(
    identifier: string | null | undefined,
  ): Promise<Product | null> {
    if (!identifier) return null;

    const rawIdentifier = String(identifier).trim();
    if (!rawIdentifier) return null;

    const normalizedIdentifier = rawIdentifier
      .replace(/^['"]|['"]$/g, '')
      .trim();
    const variants = [normalizedIdentifier];

    if (normalizedIdentifier.includes(' ')) {
      variants.push(normalizedIdentifier.replace(/\s+/g, ''));
    }

    for (const variant of variants) {
      const product = await this.productsRepository.findOne({
        where: [
          { productCode: variant },
          { barcode: variant },
          { name: variant },
        ],
      });
      if (product) return product;
    }

    const fallbackVariants = variants.flatMap((variant) => [
      variant.toUpperCase(),
      variant.toLowerCase(),
    ]);
    for (const variant of fallbackVariants) {
      const product = await this.productsRepository.findOne({
        where: [
          { productCode: variant },
          { barcode: variant },
          { name: variant },
        ],
      });
      if (product) return product;
    }

    return null;
  }

  private async findOrCreateProduct(
    identifier: string | null | undefined,
    name?: string,
    price?: number,
  ): Promise<Product | null> {
    const existingProduct = await this.findProductByIdentifier(identifier);
    if (existingProduct) {
      if (
        (!existingProduct.basePrice || Number(existingProduct.basePrice) === 0) &&
        price &&
        price > 0
      ) {
        existingProduct.basePrice = price;
        await this.productsRepository.save(existingProduct);
      }
      return existingProduct;
    }

    const rawIdentifier = String(identifier || '').trim();
    const productName = String(name || rawIdentifier || 'Sản phẩm mới').trim();
    const normalizedIdentifier = rawIdentifier
      .replace(/^['"]|['"]$/g, '')
      .trim();

    if (!productName) return null;

    const productToCreate = this.productsRepository.create({
      name: productName,
      basePrice: price ?? 0,
      ...(normalizedIdentifier
        ? { productCode: normalizedIdentifier, barcode: normalizedIdentifier }
        : {}),
    });

    return this.productsRepository.save(productToCreate);
  }

  async create(
    createOrderDto: CreateOrderDto,
    branchId: string,
    userId: string,
    skipStockDeduction = false,
  ): Promise<Order> {
    const hasItems =
      Array.isArray(createOrderDto.items) && createOrderDto.items.length > 0;
    if (!hasItems && createOrderDto.invoiceTotal == null) {
      throw new BadRequestException(
        'Order phải chứa ít nhất một sản phẩm hoặc tổng tiền hóa đơn',
      );
    }

    if (!branchId) {
      throw new BadRequestException(
        'Branch ID is required. Please select a branch before creating an order.',
      );
    }

    if (!userId) {
      throw new BadRequestException('User ID is required.');
    }

    // Calculate totals
    let subTotal = 0;
    let totalQuantity = 0;
    const orderItems: OrderItem[] = [];

    if (hasItems && createOrderDto.items) {
      for (const itemDto of createOrderDto.items) {
        const discountPercent = Number(itemDto.discountPercent) || 0;
        const discountAmount = Number(itemDto.discountAmount) || 0;
        const itemSubtotal = itemDto.quantity * itemDto.unitPrice;
        let totalPrice = itemSubtotal;
        if (discountPercent > 0) {
          totalPrice = itemSubtotal * (1 - discountPercent / 100);
        } else if (discountAmount > 0) {
          totalPrice = Math.max(0, itemSubtotal - discountAmount);
        }
        totalPrice = Math.max(0, Math.round(totalPrice * 100) / 100);
        subTotal += totalPrice;
        totalQuantity += Number(itemDto.quantity) || 0;

        const orderItem = this.orderItemsRepository.create({
          productId: itemDto.productId,
          quantity: itemDto.quantity,
          unitPrice: itemDto.unitPrice,
          discountPercent,
          discountAmount,
          totalPrice: totalPrice,
        });
        orderItems.push(orderItem);
      }
    } else if (createOrderDto.invoiceTotal != null) {
      subTotal = Number(createOrderDto.invoiceTotal);
    }

    const discount = createOrderDto.discount || 0;
    const paidAmount = Number(createOrderDto.paidAmount) || 0;
    const totalAmount = subTotal - discount;
    const walletCreditAmount = Number(createOrderDto.walletCreditAmount) || 0;

    // Generate Order Code globally for the current month/year to prevent unique key constraint conflicts across branches
    const yearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const latestOrder = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.orderCode LIKE :prefix', { prefix: `ORD-${yearMonth}-%` })
      .orderBy('order.orderCode', 'DESC')
      .getOne();

    let nextNumber = 1;
    if (latestOrder) {
      const parts = latestOrder.orderCode.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextNumber = lastSeq + 1;
      }
    }
    let orderCode = createOrderDto.orderCode?.trim();

    if (orderCode) {
      const exists = await this.ordersRepository.findOne({
        where: { orderCode },
      });
      if (exists) {
        // Ensure uniqueness by appending a suffix if the legacy code already exists
        let suffix = 2;
        const baseCode = orderCode;
        while (await this.ordersRepository.findOne({ where: { orderCode } })) {
          orderCode = `${baseCode}-${suffix}`;
          suffix += 1;
        }
      }
    } else {
      orderCode = `ORD-${yearMonth}-${nextNumber.toString().padStart(4, '0')}`;
    }

    const order = this.ordersRepository.create({
      orderCode,
      branchId,
      createdById: userId,
      customerId: createOrderDto.customerId,
      subTotal,
      discount,
      paidAmount,
      totalAmount,
      totalQuantity: createOrderDto.totalQuantity ?? totalQuantity,
      walletCreditAmount,
      status: createOrderDto.status || OrderStatus.COMPLETED,
      paymentMethod: createOrderDto.paymentMethod,
      notes: createOrderDto.notes,
      ...(createOrderDto.createdAt ? { createdAt: new Date(createOrderDto.createdAt) } : {}),
    });

    const savedOrder = await this.ordersRepository.save(order);

    if (orderItems.length > 0) {
      for (const item of orderItems) {
        item.orderId = savedOrder.id;
        item.order = savedOrder;
      }
      savedOrder.items = await this.orderItemsRepository.save(orderItems);
    } else {
      savedOrder.items = [];
    }

    // Deduct inventory for completed orders only when not importing historical data
    if (!skipStockDeduction && savedOrder.status === OrderStatus.COMPLETED) {
      for (const item of savedOrder.items) {
        await this.inventoryService.deductStock(
          item.productId,
          branchId,
          item.quantity,
          savedOrder.orderCode,
          userId,
        );
      }
    }

    // Auto top-up customer wallet if walletCreditAmount > 0
    if (walletCreditAmount > 0 && createOrderDto.customerId) {
      const customer = await this.customersRepository.findOne({
        where: { id: createOrderDto.customerId },
      });
      if (customer) {
        const currentBalance = Number(customer.walletBalance) || 0;
        await this.customersRepository.update(customer.id, {
          walletBalance: currentBalance + walletCreditAmount,
        });
      }
    }

    // Gửi thông báo Firebase FCM & Hộp thư đến cho Admin/Quản lý khi có đơn hàng mới
    try {
      const creatorRole = await this.userBranchRoleRepository.findOne({
        where: { userId, branchId, isActive: true },
        relations: ['role', 'user'],
      });

      const isCreatorAdmin = creatorRole && creatorRole.role.name === 'Admin';

      // Gửi thông báo cho Admin nếu đơn được tạo bởi nhân viên hoặc người dùng khác
      if (!isCreatorAdmin) {
        // Tìm tất cả Quản lý & Admin trong hệ thống
        const adminsAndManagers = await this.userBranchRoleRepository.find({
          where: { isActive: true },
          relations: ['role'],
        });

        const recipientIds = new Set<string>();
        adminsAndManagers.forEach((ubr) => {
          const roleName = ubr.role?.name?.toLowerCase() || '';
          if (roleName.includes('admin') || roleName.includes('quản lý') || roleName.includes('manager')) {
            recipientIds.add(ubr.userId);
          }
        });

        // Loại bỏ chính người tạo (nếu có)
        recipientIds.delete(userId);

        const creatorName = creatorRole?.user?.fullName || 'Nhân viên';
        const formattedAmount = Number(savedOrder.totalAmount || 0).toLocaleString('vi-VN');
        const orderTitle = `📦 Đơn hàng mới ${savedOrder.orderCode}`;
        const orderMessage = `Nhân viên ${creatorName} vừa tạo đơn hàng ${savedOrder.orderCode} trị giá ${formattedAmount}₫`;

        for (const recipientId of recipientIds) {
          await this.notificationsService.sendNotificationToUser(recipientId, {
            title: orderTitle,
            content: orderMessage,
            type: 'ORDER_CREATED',
            metadata: {
              orderId: savedOrder.id,
              orderCode: savedOrder.orderCode,
              totalAmount: savedOrder.totalAmount,
              creatorName,
            },
          });
        }
      }
    } catch (err) {
      console.error('Failed to trigger order creation notifications:', err);
    }

    return savedOrder;
  }

  async importOrderDetailsFromExcel(
    buffer: Buffer,
    branchId: string,
    userId: string,
    options?: { createMissingOrders?: boolean; skipStockDeduction?: boolean },
  ): Promise<{
    imported: number;
    errors: any[];
    errorFile?: string;
    errorFileName?: string;
  }> {
    if (!buffer) throw new BadRequestException('File buffer is required');
    if (!branchId) throw new BadRequestException('Branch ID is required');

    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const results: {
      imported: number;
      errors: any[];
      errorFile?: string;
      errorFileName?: string;
    } = { imported: 0, errors: [] };
    const orderGroups = new Map<string, any[]>();

    const normalizeKey = (value: unknown) => {
      if (value === undefined || value === null) return '';
      return String(value)
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    };

    const findValue = (row: Record<string, unknown>, candidates: string[]) => {
      const normalizedRow: Record<string, unknown> = {};
      const keys = Object.keys(row || {});
      for (const key of keys) {
        normalizedRow[normalizeKey(key)] = row[key];
      }
      for (const candidate of candidates) {
        const nc = normalizeKey(candidate);
        if (
          normalizedRow[nc] !== undefined &&
          normalizedRow[nc] !== null &&
          String(normalizedRow[nc]).trim() !== ''
        ) {
          return String(normalizedRow[nc]).trim();
        }
        for (const nk of Object.keys(normalizedRow)) {
          if (!nk) continue;
          if (nk.includes(nc) || nc.includes(nk)) {
            const v = normalizedRow[nk];
            if (v !== undefined && v !== null && String(v).trim() !== '')
              return String(v).trim();
          }
        }
      }
      return null;
    };

    const toNumber = (value: unknown) => {
      if (value === undefined || value === null) return null;
      const text = String(value)
        .replace(/\s+/g, '')
        .replace(/,/g, '.')
        .replace(/[^0-9.\-]/g, '');
      const parsed = parseFloat(text);
      return Number.isFinite(parsed) ? parsed : null;
    };

    let lastOrderCode = '';
    for (const [index, row] of rows.entries()) {
      let orderCode = findValue(row, ['Mã hóa đơn', 'Mã đơn']) || null;
      const productIdentifier = findValue(row, [
        'productcode',
        'mãhàng',
        'mã hàng',
        'barcode',
        'sku',
        'productid',
        'product',
        'tênhàng',
        'tên hàng',
        'itemcode',
        'item',
        'productcode1',
        'code',
        'mã sản phẩm',
        'masp',
        'masanpham',
        'productname',
        'name',
        'tensp',
        'tênsp',
        'tenhang',
        'mah',
        'mahang',
      ]);
      const productName = findValue(row, [
        'productname',
        'tênhàng',
        'tên hàng',
        'name',
        'itemname',
        'tensp',
        'ten sp',
        'tên sản phẩm',
        'ten san pham',
      ]);
      const quantity =
        toNumber(
          findValue(row, [
            'quantity',
            'soluong',
            'sốlượng',
            'qty',
            'sl',
            'so luong',
          ]),
        ) || null;

      // Ignore row if it's completely blank or a total summary row with no product/quantity details
      if (
        !orderCode &&
        !productIdentifier &&
        !productName &&
        quantity === null
      ) {
        continue;
      }

      // Inherit orderCode from previous row if cells are merged in Excel
      if (!orderCode && lastOrderCode && (productIdentifier || productName)) {
        orderCode = lastOrderCode;
      }
      if (orderCode) {
        lastOrderCode = orderCode;
      }

      let unitPrice =
        toNumber(
          findValue(row, [
            'unitprice',
            'đơngiá',
            'đơn giá',
            'dongia',
            'don gia',
            'giaban',
            'giá bán',
            'gia ban',
            'price',
            'giá',
            'gia',
            'unitprice',
            'dongia',
            'donGia',
          ]),
        ) || null;

      // If unitPrice not found, try to calculate from totalAmount and quantity
      if (unitPrice === null && quantity && quantity > 0) {
        const totalAmount = toNumber(
          findValue(row, [
            'thanhtien',
            'thành tiền',
            'total',
            'tongtien',
            'tổng tiền',
            'totalamount',
            'total_amount',
          ]),
        );
        if (totalAmount && totalAmount > 0) {
          unitPrice = Math.round((totalAmount / quantity) * 100) / 100; // Calculate unit price with 2 decimal places
        }
      }

      const errors: string[] = [];
      if (!orderCode) errors.push('Thiếu mã đơn hàng');
      if (!productIdentifier && !productName)
        errors.push('Thiếu mã hoặc tên sản phẩm');
      if (quantity === null) errors.push('Thiếu số lượng');

      if (errors.length > 0) {
        results.errors.push({
          row: index + 2,
          reason: errors.join('; '),
          orderCode: orderCode || '',
        });
        continue;
      }

      const resolvedUnitPrice = unitPrice ?? 0;
      const discountPercentVal =
        toNumber(
          findValue(row, [
            'discountpercent',
            'chiết khấu %',
            'chiết khấu(%)',
            'chietkhau%',
            'giảm giá %',
            'giam gia %',
            'giảm giá(%)',
            'giamgia%',
            'discount%',
            'ck%',
          ]),
        ) || 0;

      const rawDiscountVal =
        toNumber(
          findValue(row, [
            'ck',
            'chiết khấu',
            'chietkhau',
            'giảm giá',
            'giamgia',
            'discount',
          ]),
        ) || 0;

      let discountPercent = 0;
      let discountAmount = 0;

      if (discountPercentVal > 0) {
        discountPercent = discountPercentVal;
      } else if (rawDiscountVal > 0) {
        if (rawDiscountVal <= 100) {
          discountPercent = rawDiscountVal;
        } else {
          discountAmount = rawDiscountVal;
        }
      }

      if (!orderGroups.has(orderCode!)) orderGroups.set(orderCode!, []);
      orderGroups.get(orderCode!)!.push({
        orderCode,
        productIdentifier,
        productName,
        quantity,
        unitPrice: resolvedUnitPrice,
        discountPercent,
        discountAmount,
        row: index + 2,
      });
    }

    const createMissing = options?.createMissingOrders ?? true;
    const skipStock = options?.skipStockDeduction ?? true;

    for (const [orderCode, groupRows] of orderGroups.entries()) {
      try {
        // Find existing order in branch or globally by orderCode
        let order = await this.ordersRepository.findOne({
          where: { orderCode, branchId },
        });
        if (!order) {
          order = await this.ordersRepository.findOne({
            where: { orderCode },
          });
        }

        if (!order) {
          if (createMissing) {
            const newOrder = this.ordersRepository.create({
              orderCode,
              branchId,
              createdById: userId,
              subTotal: 0,
              discount: 0,
              totalAmount: 0,
              status: OrderStatus.COMPLETED,
              paymentMethod: PaymentMethod.CASH,
            });
            order = await this.ordersRepository.save(newOrder);
          } else {
            results.errors.push({
              orderCode,
              reason: `Đơn hàng ${orderCode} không tồn tại trong hệ thống. Vui lòng nhập danh sách đơn hàng trước.`,
              row: groupRows[0]?.row || '',
            });
            continue;
          }
        }

        // order exists: append items
        let added = 0;
        for (const r of groupRows) {
          const prod = await this.findOrCreateProduct(
            r.productIdentifier,
            r.productName,
            r.unitPrice,
          );
          if (!prod) {
            results.errors.push({
              row: r.row,
              orderCode,
              reason: `Product not found: ${r.productIdentifier || r.productName || 'unknown'}`,
            });
            continue;
          }
          const itemSubtotal = Number(r.quantity) * Number(r.unitPrice);
          const discPct = Number(r.discountPercent || 0);
          const discAmt = Number(r.discountAmount || 0);
          let totalPrice = itemSubtotal;
          if (discPct > 0) {
            totalPrice = itemSubtotal * (1 - discPct / 100);
          } else if (discAmt > 0) {
            totalPrice = Math.max(0, itemSubtotal - discAmt);
          }
          totalPrice = Math.max(0, Math.round(totalPrice * 100) / 100);

          const orderItem = this.orderItemsRepository.create({
            orderId: order.id,
            order: order,
            productId: prod.id,
            quantity: r.quantity,
            unitPrice: r.unitPrice,
            discountPercent: discPct,
            discountAmount: discAmt,
            totalPrice,
          });
          await this.orderItemsRepository.save(orderItem);
          // update order totals
          order.subTotal = Number(order.subTotal || 0) + totalPrice;
          order.totalAmount =
            Number(order.subTotal) - Number(order.discount || 0);
          order.totalQuantity =
            Number(order.totalQuantity || 0) + Number(r.quantity || 0);

          // deduct stock immediately if order completed and stock deduction allowed
          if (!skipStock && order.status === OrderStatus.COMPLETED) {
            try {
              await this.inventoryService.deductStock(
                prod.id,
                branchId,
                r.quantity,
                order.orderCode,
                userId,
              );
            } catch (err) {
              // log but continue
              console.error('Stock deduction failed for imported item', err);
            }
          }
          added += 1;
        }
        if (added > 0) {
          await this.ordersRepository.save(order);
          results.imported += 1;
        }
      } catch (err) {
        results.errors.push({ orderCode, reason: err.message || err, row: '' });
      }
    }

    if (results.errors.length > 0) {
      try {
        const errorRows = results.errors.map((error) => ({
          orderCode: error.orderCode || '',
          row: error.row || '',
          reason: error.reason || '',
        }));
        const ws = xlsx.utils.json_to_sheet(errorRows);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Errors');

        const uploadPath = path.resolve('uploads', 'orders');
        if (!fs.existsSync(uploadPath))
          fs.mkdirSync(uploadPath, { recursive: true });
        const filename = `orders_details_import_errors_${Date.now()}.xlsx`;
        const filePath = path.join(uploadPath, filename);
        xlsx.writeFile(wb, filePath);
        results.errorFile = path.posix.join('/uploads/orders', filename);
        results.errorFileName = filename;
        results.errorFileName = filename;
      } catch (writeError) {
        results.errors.push({
          reason: `Không thể ghi file lỗi: ${writeError.message || writeError}`,
        });
      }
    }

    return results;
  }

  async findAll(
    branchId: string,
    page: number | string = 1,
    limit: number | string = 10,
    customerId?: string,
    createdById?: string,
    status?: string,
    search?: string,
  ): Promise<{
    data: Order[];
    total: number;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const pageNumber = Math.max(1, Math.floor(Number(page) || 1));
    const limitNumber = Math.max(1, Math.floor(Number(limit) || 10));
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.createdBy', 'createdBy');

    if (branchId && branchId !== 'undefined' && branchId !== 'null') {
      qb.andWhere('order.branchId = :branchId', { branchId });
    }

    if (customerId) {
      qb.andWhere('order.customerId = :customerId', { customerId });
    }

    if (createdById) {
      qb.andWhere('order.createdById = :createdById', { createdById });
    }

    if (status && status !== 'ALL') {
      qb.andWhere('order.status = :status', { status });
    }

    if (search) {
      const searchValue = `%${search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(order.orderCode) LIKE :search OR LOWER(customer.fullName) LIKE :search OR customer.phone LIKE :search)',
        { search: searchValue },
      );
    }

    const [data, total] = await qb
      .orderBy('order.createdAt', 'DESC')
      .skip((pageNumber - 1) * limitNumber)
      .take(limitNumber)
      .getManyAndCount();

    return {
      data,
      total,
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.max(1, Math.ceil(total / limitNumber)),
      },
    };
  }

  async importOrdersFromExcel(
    buffer: Buffer,
    branchId: string,
    userId: string,
  ): Promise<{
    imported: number;
    errors: any[];
    errorFile?: string;
    errorFileName?: string;
  }> {
    if (!buffer) {
      throw new BadRequestException('File buffer is required');
    }
    if (!branchId) {
      throw new BadRequestException('Branch ID is required');
    }

    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const results: {
      imported: number;
      errors: any[];
      errorFile?: string;
      errorFileName?: string;
    } = { imported: 0, errors: [] };
    const orderGroups = new Map<string, any[]>();

    const normalizeKey = (value: unknown) => {
      if (value === undefined || value === null) return '';
      return String(value)
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    };

    const findValue = (row: Record<string, unknown>, candidates: string[]) => {
      const normalizedRow: Record<string, unknown> = {};
      const keys = Object.keys(row || {});
      for (const key of keys) {
        normalizedRow[normalizeKey(key)] = row[key];
      }
      for (const candidate of candidates) {
        const nc = normalizeKey(candidate);
        // attempt exact normalized key match first
        if (
          normalizedRow[nc] !== undefined &&
          normalizedRow[nc] !== null &&
          String(normalizedRow[nc]).trim() !== ''
        ) {
          return String(normalizedRow[nc]).trim();
        }
        // fallback: substring matching (handles header variations like "mã hóa đơn")
        for (const nk of Object.keys(normalizedRow)) {
          if (!nk) continue;
          if (nk.includes(nc) || nc.includes(nk)) {
            const v = normalizedRow[nk];
            if (v !== undefined && v !== null && String(v).trim() !== '')
              return String(v).trim();
          }
        }
      }
      return null;
    };

    const findRawValue = (
      row: Record<string, unknown>,
      candidates: string[],
    ) => {
      const normalizedRow: Record<string, unknown> = {};
      const keys = Object.keys(row || {});
      for (const key of keys) {
        normalizedRow[normalizeKey(key)] = row[key];
      }
      for (const candidate of candidates) {
        const nc = normalizeKey(candidate);
        if (
          normalizedRow[nc] !== undefined &&
          normalizedRow[nc] !== null &&
          String(normalizedRow[nc]).trim() !== ''
        ) {
          return normalizedRow[nc];
        }
        for (const nk of Object.keys(normalizedRow)) {
          if (!nk) continue;
          if (nk.includes(nc) || nc.includes(nk)) {
            const v = normalizedRow[nk];
            if (v !== undefined && v !== null && String(v).trim() !== '')
              return v;
          }
        }
      }
      return null;
    };

    const parseExcelDateValue = (value: unknown): Date | null => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      if (typeof value === 'number') {
        const dateObj = xlsx.SSF.parse_date_code(value);
        if (dateObj && dateObj.y) {
          return new Date(
            Date.UTC(
              dateObj.y,
              dateObj.m - 1,
              dateObj.d,
              dateObj.H,
              dateObj.M,
              dateObj.S || 0,
            ),
          );
        }
        return null;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        const numeric = Number(trimmed.replace(/,/g, '.'));
        if (!Number.isNaN(numeric) && numeric > 20000 && numeric < 60000) {
          const dateObj = xlsx.SSF.parse_date_code(numeric);
          if (dateObj && dateObj.y) {
            return new Date(
              Date.UTC(
                dateObj.y,
                dateObj.m - 1,
                dateObj.d,
                dateObj.H,
                dateObj.M,
                dateObj.S || 0,
              ),
            );
          }
          return null;
        }
        const vietnameseDate = trimmed.match(
          /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
        );
        if (vietnameseDate) {
          const [, day, month, year, hour = '0', minute = '0', second = '0'] = vietnameseDate;
          return new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second),
          );
        }
        const parsedDate = new Date(trimmed);
        return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
      }
      return null;
    };

    const toNumber = (value: unknown) => {
      if (value === undefined || value === null) return null;
      const text = String(value)
        .replace(/\s+/g, '')
        .replace(/,/g, '.')
        .replace(/[^0-9.\-]/g, '');
      const parsed = parseFloat(text);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const parseOrderStatus = (
      value: string | null | undefined,
    ): OrderStatus => {
      if (!value) return OrderStatus.COMPLETED;
      const normalized = value.trim().toUpperCase();
      if (
        normalized.includes('PENDING') ||
        normalized.includes('CHỜ') ||
        normalized.includes('CHO')
      )
        return OrderStatus.PENDING;
      if (
        normalized.includes('CANCELLED') ||
        normalized.includes('HỦY') ||
        normalized.includes('HUY')
      )
        return OrderStatus.CANCELLED;
      if (
        normalized.includes('DRAFT') ||
        normalized.includes('NHÁP') ||
        normalized.includes('NHAP')
      )
        return OrderStatus.DRAFT;
      return OrderStatus.COMPLETED;
    };

    const parsePaymentMethod = (
      value: string | null | undefined,
    ): PaymentMethod => {
      if (!value) return PaymentMethod.CASH;
      const normalized = value.trim().toUpperCase();
      if (
        normalized.includes('TRANSFER') ||
        normalized.includes('CHUYỂN') ||
        normalized.includes('CHUYEN')
      )
        return PaymentMethod.TRANSFER;
      if (
        normalized.includes('CARD') ||
        normalized.includes('THẺ') ||
        normalized.includes('THE')
      )
        return PaymentMethod.CARD;
      return PaymentMethod.CASH;
    };

    for (const [index, row] of rows.entries()) {
      const orderCode =
        findValue(row, [
          'ordercode',
          'mãđơn',
          'mã đơn',
          'order',
          'invoice',
          'hóa đơn',
          'hoadon',
          'số hóa đơn',
          'sohoadon',
        ]) || `LEGACY-${Date.now()}-${index + 1}`;
      const customerName = findValue(row, [
        'customername',
        'tênkhách',
        'tên khách',
        'customer',
        'khách hàng',
        'khachhang',
      ]);
      const customerPhone = findValue(row, [
        'phone',
        'điệnthoại',
        'sốđiệnthoại',
        'sdt',
        'dienthoai',
      ]);
      const customerCode = findValue(row, [
        'customercode',
        'mã khách hàng',
        'mãkhách hàng',
        'mã kh',
        'mãkh',
        'mã KH',
        'mãkhách',
        'code',
      ]);
      const invoiceTime = parseExcelDateValue(
        findRawValue(row, [
          'thoigian',
          'thời gian',
          'thoi gian',
          'time',
          'date',
        ]),
      );
      const productIdentifier = findValue(row, [
        'productcode',
        'mãhàng',
        'mã hàng',
        'barcode',
        'sku',
        'productid',
        'product',
      ]);
      const productName = findValue(row, [
        'productname',
        'tênhàng',
        'tên hàng',
        'name',
      ]);
      const quantity = toNumber(
        findValue(row, ['quantity', 'soluong', 'sốlượng', 'qty']),
      );
      const unitPrice = toNumber(
        findValue(row, ['unitprice', 'đơngiá', 'đơngiá', 'price', 'giá']),
      );
      const itemDiscountPercent =
        toNumber(
          findValue(row, [
            'discountpercent',
            'chiết khấu %',
            'chiết khấu(%)',
            'chietkhau%',
            'giảm giá %',
            'giam gia %',
            'giảm giá(%)',
            'giamgia%',
            'discount%',
            'ck%',
          ]),
        ) || 0;
      const invoiceTotal = toNumber(
        findValue(row, [
          'tổng tiền hàng',
          'tổng tiền',
          'tong tien hang',
          'tong tien',
          'total',
          'totalamount',
          'amount',
          'tienhang',
        ]),
      );
      const paymentMethod = parsePaymentMethod(
        findValue(row, [
          'paymentmethod',
          'payment',
          'hìnhthứcthanhtoán',
          'hinhthucthanhtoan',
        ]),
      );
      const status = parseOrderStatus(
        findValue(row, ['status', 'trạngthái', 'trangthai']),
      );
      const notes = findValue(row, ['notes', 'ghi chú', 'ghichu', 'note']);
      const discount =
        toNumber(
          findValue(row, [
            'giảm giá',
            'giam gia',
            'giảm giá đơn hàng',
            'giảm giá hóa đơn',
            'chiếtkhấu',
            'chietkhau',
            'discount',
          ]),
        ) || 0;
      const paidAmount =
        toNumber(
          findValue(row, [
            'khách đã trả',
            'khach da tra',
            'khách hàng đã trả',
            'tiền khách trả',
            'tien khach tra',
            'customer paid',
            'paid amount',
          ]),
        ) || 0;

      // Skip row if it is completely blank / total summary row with no data
      if (
        !productIdentifier &&
        !productName &&
        quantity === null &&
        invoiceTotal === null
      ) {
        continue;
      }

      const errors = [] as string[];
      if (!productIdentifier && invoiceTotal === null) {
        errors.push('Thiếu thông tin sản phẩm hoặc tổng tiền hóa đơn');
      }
      if (quantity === null && invoiceTotal === null) {
        errors.push('Thiếu số lượng hoặc tổng tiền hóa đơn');
      }

      if (errors.length > 0) {
        results.errors.push({
          row: index + 2,
          reason: errors.join('; '),
          orderCode: orderCode || '',
        });
        continue;
      }

      const resolvedUnitPrice = unitPrice ?? 0;

      const normalizedCode = orderCode || `LEGACY-${Date.now()}-${index + 1}`;
      if (!orderGroups.has(normalizedCode)) {
        orderGroups.set(normalizedCode, []);
      }
      orderGroups.get(normalizedCode)!.push({
        orderCode: normalizedCode,
        customerName,
        customerPhone,
        customerCode,
        invoiceTime,
        productIdentifier,
        productName,
        quantity: quantity ?? (invoiceTotal !== null ? 1 : 0),
        unitPrice: resolvedUnitPrice ?? invoiceTotal ?? 0,
        discountPercent: itemDiscountPercent,
        invoiceTotal,
        paymentMethod,
        status,
        notes,
        discount,
        paidAmount,
      });
    }

    for (const [orderCode, groupRows] of orderGroups.entries()) {
      try {
        const firstRow = groupRows[0];

        let customerId: string | undefined;
        if (firstRow.customerPhone || firstRow.customerCode) {
          const whereConditions: any[] = [];
          if (firstRow.customerPhone)
            whereConditions.push({ phone: firstRow.customerPhone });
          if (firstRow.customerCode)
            whereConditions.push({ code: firstRow.customerCode });
          const existingCustomer = whereConditions.length
            ? await this.customersRepository.findOne({ where: whereConditions })
            : null;
          if (existingCustomer) {
            customerId = existingCustomer.id;
          } else {
            const customer = this.customersRepository.create({
              fullName: firstRow.customerName || 'Khách vãng lai',
              phone: firstRow.customerPhone || null,
              code: firstRow.customerCode || null,
            });
            const savedCustomer = await this.customersRepository.save(customer);
            customerId = savedCustomer.id;
          }
        }

        const orderNotes = [
          firstRow.notes,
          firstRow.invoiceTime
            ? `Thời gian: ${firstRow.invoiceTime.toLocaleString('vi-VN')}`
            : null,
        ]
          .filter(Boolean)
          .join(' | ');

        const items = [] as any[];
        for (const r of groupRows) {
          if (r.productIdentifier || r.productName) {
            const prod = await this.findOrCreateProduct(
              r.productIdentifier,
              r.productName,
              r.unitPrice,
            );
            if (prod) {
              items.push({
                productId: prod.id,
                quantity: r.quantity,
                unitPrice: r.unitPrice,
                discountPercent: r.discountPercent,
              });
            }
          }
        }

        const createDto: CreateOrderDto = {
          orderCode,
          customerId,
          status: firstRow.status,
          paymentMethod: firstRow.paymentMethod,
          notes: orderNotes,
          discount: firstRow.discount,
          paidAmount: firstRow.paidAmount,
          invoiceTotal: firstRow.invoiceTotal,
          items: items.length > 0 ? items : undefined,
          ...(firstRow.invoiceTime
            ? { createdAt: firstRow.invoiceTime.toISOString() }
            : {}),
        };

        await this.create(createDto, branchId, userId, true);
        results.imported += 1;
      } catch (error) {
        results.errors.push({
          orderCode,
          reason: error.message || 'Lỗi khi tạo đơn hàng',
          row: '',
        });
      }
    }

    if (results.errors.length > 0) {
      try {
        const errorRows = results.errors.map((error) => ({
          orderCode: error.orderCode || '',
          row: error.row || '',
          reason: error.reason || '',
        }));
        const ws = xlsx.utils.json_to_sheet(errorRows);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Errors');

        const uploadPath = path.resolve('uploads', 'orders');
        if (!fs.existsSync(uploadPath))
          fs.mkdirSync(uploadPath, { recursive: true });
        const filename = `orders_import_errors_${Date.now()}.xlsx`;
        const filePath = path.join(uploadPath, filename);
        xlsx.writeFile(wb, filePath);
        results.errorFile = path.posix.join('/uploads/orders', filename);
        results.errorFileName = filename;
        results.errorFileName = filename;
      } catch (writeError) {
        results.errors.push({
          reason: `Không thể ghi file lỗi: ${writeError.message || writeError}`,
        });
      }
    }

    return results;
  }

  async findOne(id: string, branchId?: string): Promise<Order> {
    const whereClause: any = { id };
    if (branchId && branchId !== 'undefined' && branchId !== 'null') {
      whereClause.branchId = branchId;
    }

    const order = await this.ordersRepository.findOne({
      where: whereClause,
      relations: ['customer', 'createdBy', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async updateOrder(
    id: string,
    branchId: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<Order> {
    const order = await this.findOne(id, branchId);
    const { items, invoiceTotal, totalQuantity, ...orderFields } = updateOrderDto;

    if (orderFields.orderCode !== undefined) {
      const orderCode = orderFields.orderCode.trim();
      if (orderCode && orderCode !== order.orderCode) {
        const existingOrder = await this.ordersRepository.findOne({
          where: { orderCode },
        });
        if (existingOrder) {
          throw new BadRequestException(`Mã đơn hàng ${orderCode} đã tồn tại`);
        }
      }
      order.orderCode = orderCode;
    }

    if (orderFields.customerId !== undefined) order.customerId = orderFields.customerId;
    if (orderFields.status !== undefined) order.status = orderFields.status;
    if (orderFields.paymentMethod !== undefined) order.paymentMethod = orderFields.paymentMethod;
    if (orderFields.notes !== undefined) order.notes = orderFields.notes;
    if (orderFields.discount !== undefined) order.discount = Number(orderFields.discount) || 0;
    if (orderFields.paidAmount !== undefined) order.paidAmount = Number(orderFields.paidAmount) || 0;
    if (orderFields.walletCreditAmount !== undefined) {
      order.walletCreditAmount = Number(orderFields.walletCreditAmount) || 0;
    }
    if (orderFields.createdAt !== undefined) {
      const createdAt = new Date(orderFields.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        throw new BadRequestException('Ngày hóa đơn không hợp lệ');
      }
      order.createdAt = createdAt;
    }

    if (items !== undefined) {
      let subTotal = 0;
      let calculatedQuantity = 0;
      const orderItems = items.map((item) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const discountPercent = Number(item.discountPercent) || 0;
        const discountAmount = Number(item.discountAmount) || 0;
        const itemSubtotal = quantity * unitPrice;
        let totalPrice = itemSubtotal;
        if (discountPercent > 0) {
          totalPrice = itemSubtotal * (1 - discountPercent / 100);
        } else if (discountAmount > 0) {
          totalPrice = Math.max(0, itemSubtotal - discountAmount);
        }
        totalPrice = Math.max(0, Math.round(totalPrice * 100) / 100);
        subTotal += totalPrice;
        calculatedQuantity += quantity;

        return this.orderItemsRepository.create({
          orderId: order.id,
          order,
          productId: item.productId,
          quantity,
          unitPrice,
          discountPercent,
          discountAmount,
          totalPrice,
        });
      });

      await this.orderItemsRepository.delete({ orderId: order.id });
      order.items = orderItems.length
        ? await this.orderItemsRepository.save(orderItems)
        : [];
      order.subTotal = subTotal;
      order.totalQuantity = totalQuantity ?? calculatedQuantity;
    } else if (invoiceTotal !== undefined) {
      order.subTotal = Number(invoiceTotal) || 0;
      if (totalQuantity !== undefined) {
        order.totalQuantity = Number(totalQuantity) || 0;
      }
    } else if (totalQuantity !== undefined) {
      order.totalQuantity = Number(totalQuantity) || 0;
    }

    order.totalAmount = Number(order.subTotal || 0) - Number(order.discount || 0);
    await this.ordersRepository.save(order);
    return this.findOne(id, branchId);
  }

  async updateStatus(
    id: string,
    branchId: string,
    status: OrderStatus,
    userId?: string,
  ): Promise<Order> {
    const order = await this.findOne(id, branchId);

    if (
      status === OrderStatus.COMPLETED &&
      order.status !== OrderStatus.COMPLETED
    ) {
      for (const item of order.items) {
        await this.inventoryService.deductStock(
          item.productId,
          branchId,
          item.quantity,
          order.orderCode,
          userId || order.createdById,
        );
      }
    }

    order.status = status;
    return this.ordersRepository.save(order);
  }

  async updateOrderDate(
    id: string,
    branchId: string,
    createdAt: string,
  ): Promise<Order> {
    const order = await this.findOne(id, branchId);
    if (!createdAt) {
      throw new BadRequestException('Ngày hóa đơn không hợp lệ');
    }
    order.createdAt = new Date(createdAt);
    return this.ordersRepository.save(order);
  }
}
