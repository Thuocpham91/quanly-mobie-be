import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';

export enum ServiceOrderStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('service_orders')
export class ServiceOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderCode: string;

  @Column({ type: 'date', nullable: true })
  appointmentDate: Date;

  @Column({ nullable: true })
  appointmentTime: string; // HH:mm:ss format

  @Column({ type: 'date', nullable: true })
  deadline: Date;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  customerLocation: string; // URL

  @Column({ type: 'text', nullable: true })
  jobDescription: string;

  @Column({ type: 'text', nullable: true })
  completedItems: string;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  quotedAmount: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  discount: number;

  @Column({
    type: 'enum',
    enum: ServiceOrderStatus,
    default: ServiceOrderStatus.PENDING,
  })
  status: ServiceOrderStatus;

  @Column()
  branchId: string;

  @Column({ nullable: true })
  customerId: string;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
