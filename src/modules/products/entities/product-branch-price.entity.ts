import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Product } from './product.entity';
import { Branch } from '../../branches/entities/branch.entity';

@Entity('product_branch_prices')
export class ProductBranchPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, product => product.branchPrices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
