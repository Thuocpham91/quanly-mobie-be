import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, OneToMany
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { Distributor } from '../../distributors/entities/distributor.entity';
import { User } from '../../users/entities/user.entity';
import { InventoryBatch } from './inventory-batch.entity';

export enum ImportOrderStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('inventory_orders')
export class InventoryOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  code!: string;

  @Column()
  branchId!: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch!: Branch;

  @Column({ nullable: true })
  distributorId!: string;

  @ManyToOne(() => Distributor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'distributorId' })
  distributor!: Distributor;

  @Column({ nullable: true })
  invoiceName!: string;

  @Column({ nullable: true })
  invoiceNumber!: string;

  @Column({ nullable: true })
  personnelName!: string;

  @Column({ nullable: true })
  importDate!: Date;

  @Column({ nullable: true })
  note!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalProductAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingFee!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  debtAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalQuantity!: number;

  @Column({ type: 'int', default: 0 })
  totalItemCount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount!: number;

  @Column({
    type: 'enum',
    enum: ImportOrderStatus,
    default: ImportOrderStatus.COMPLETED,
  })
  status!: ImportOrderStatus;

  @Column({ nullable: true })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy!: User;

  @OneToMany(() => InventoryBatch, (batch) => batch.importOrder)
  batches!: InventoryBatch[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
