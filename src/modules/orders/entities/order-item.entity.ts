import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 14, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 14, scale: 2, default: 0, nullable: true })
  discountPercent: number;

  @Column('decimal', { precision: 14, scale: 2, default: 0, nullable: true })
  discountAmount: number;

  @Column('decimal', { precision: 14, scale: 2 })
  totalPrice: number;
}
