import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';

export enum StockMovementType {
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  SALE = 'SALE',
  ADJUST = 'ADJUST',
}

@Entity('inventory_logs')
export class InventoryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({
    type: 'enum',
    enum: StockMovementType,
    default: StockMovementType.SALE,
  })
  type: StockMovementType;

  @Column({ type: 'int' })
  quantity: number; // positive for imports, negative for exports/sales

  @Column({ nullable: true })
  batchId: string;

  @Column({ nullable: true })
  referenceCode: string; // E.g., order code ORD-XXX, or import receipt code

  @Column({ nullable: true })
  note: string;

  @Column({ nullable: true })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;
}
