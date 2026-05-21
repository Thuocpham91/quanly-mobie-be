import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/order.dto';
import { InventoryService } from '../inventory/inventory.service';
import { Customer } from '../customers/entities/customer.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(createOrderDto: CreateOrderDto, branchId: string, userId: string): Promise<Order> {
    if (!createOrderDto.items || createOrderDto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    if (!branchId) {
      throw new BadRequestException('Branch ID is required. Please select a branch before creating an order.');
    }

    if (!userId) {
      throw new BadRequestException('User ID is required.');
    }

    // Calculate totals
    let subTotal = 0;
    const orderItems: OrderItem[] = [];

    for (const itemDto of createOrderDto.items) {
      const totalPrice = itemDto.quantity * itemDto.unitPrice;
      subTotal += totalPrice;

      const orderItem = this.orderItemsRepository.create({
        productId: itemDto.productId,
        quantity: itemDto.quantity,
        unitPrice: itemDto.unitPrice,
        totalPrice: totalPrice,
      });
      orderItems.push(orderItem);
    }

    const discount = createOrderDto.discount || 0;
    const totalAmount = subTotal - discount;
    const walletCreditAmount = Number(createOrderDto.walletCreditAmount) || 0;

    // Generate Order Code
    const count = await this.ordersRepository.count({ where: { branchId } });
    const orderCode = `ORD-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(count + 1).toString().padStart(4, '0')}`;

    const order = this.ordersRepository.create({
      orderCode,
      branchId,
      createdById: userId,
      customerId: createOrderDto.customerId,
      petId: createOrderDto.petId,
      subTotal,
      discount,
      totalAmount,
      walletCreditAmount,
      status: createOrderDto.status || OrderStatus.COMPLETED,
      paymentMethod: createOrderDto.paymentMethod,
      notes: createOrderDto.notes,
      items: orderItems,
    });

    const savedOrder = await this.ordersRepository.save(order);

    // Deduct inventory for completed orders
    if (savedOrder.status === OrderStatus.COMPLETED) {
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

    return savedOrder;
  }

  async findAll(branchId: string, page = 1, limit = 10, petId?: string, customerId?: string): Promise<{ data: Order[]; total: number }> {
    const where: any = {};
    if (branchId && branchId !== 'undefined' && branchId !== 'null') {
      where.branchId = branchId;
    }
    if (petId) {
      where.petId = petId;
    }
    if (customerId) {
      where.customerId = customerId;
    }

    const [data, total] = await this.ordersRepository.findAndCount({
      where,
      relations: ['customer', 'createdBy', 'pet'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async findOne(id: string, branchId?: string): Promise<Order> {
    const whereClause: any = { id };
    if (branchId && branchId !== 'undefined' && branchId !== 'null') {
      whereClause.branchId = branchId;
    }

    const order = await this.ordersRepository.findOne({
      where: whereClause,
      relations: ['customer', 'createdBy', 'pet', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async updateStatus(id: string, branchId: string, status: OrderStatus, userId?: string): Promise<Order> {
    const order = await this.findOne(id, branchId);
    
    if (status === OrderStatus.COMPLETED && order.status !== OrderStatus.COMPLETED) {
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
}
