import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { Distributor } from '../../distributors/entities/distributor.entity';

@Entity('inventory_batches')
export class InventoryBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, (product) => product.batches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({ nullable: true })
  distributorId: string;

  @ManyToOne(() => Distributor, (distributor) => distributor.batches, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'distributorId' })
  distributor: Distributor;

  @Column({ type: 'int', default: 0 })
  importedQuantity: number;

  @Column({ type: 'int', default: 0 })
  currentQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  costPrice: number;

  @Column({ nullable: true })
  importDate: Date;

  @Column({ nullable: true })
  expiryDate: Date;

  @Column({ nullable: true })
  invoiceName: string;

  @Column({ type: 'boolean', default: false })
  isGift: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingFee: number;

  @Column({ nullable: true })
  personnelName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
