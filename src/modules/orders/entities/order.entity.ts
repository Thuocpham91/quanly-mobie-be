import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { OrderItem } from './order-item.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  CARD = 'CARD',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderCode: string;

  @Column({ nullable: true })
  customerId: string;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column()
  branchId: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column()
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  subTotal: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  discount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.COMPLETED })
  status: OrderStatus;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  @Column({ nullable: true })
  notes: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0, nullable: true })
  walletCreditAmount: number;

  @OneToMany(() => OrderItem, item => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
