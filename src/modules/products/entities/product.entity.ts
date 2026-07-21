import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { InventoryBatch } from '../../inventory/entities/inventory-batch.entity';
import { Category } from '../../categories/entities/category.entity';
import { ItemGroup } from '../../item-groups/entities/item-group.entity';
import { Classification } from './classification.entity';
import { Unit } from './unit.entity';
import { ProductUnit } from './product-unit.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  barcode: string;

  @Column()
  name: string;

  @Column({ unique: true, nullable: true })
  productCode: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column('simple-array', { nullable: true })
  imageUrls: string[];

  @Column({ nullable: true })
  manufacturer: string;

  @Column({ nullable: true })
  categoryId: string;

  @ManyToOne(() => Category, (category) => category.products, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ nullable: true })
  itemGroupId: string;

  @ManyToOne(() => ItemGroup, (itemGroup) => itemGroup.products, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'itemGroupId' })
  itemGroup: ItemGroup;

  @Column({ nullable: true })
  classificationId: string;

  @ManyToOne(() => Classification, (classification) => classification.products, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'classificationId' })
  classification: Classification;

  @Column({ nullable: true })
  unitId: string;

  @ManyToOne(() => Unit)
  @JoinColumn({ name: 'unitId' })
  unit: Unit;

  @OneToMany(() => ProductUnit, (productUnit) => productUnit.product, { cascade: true })
  units: ProductUnit[];

  @Column({ nullable: true })
  usage: string;

  @OneToMany('InventoryBatch', 'product')
  batches: any[];

  @Column({ default: false })
  isService: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  basePrice: number;

  @OneToMany('ProductBranchPrice', 'product', { cascade: true })
  branchPrices: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
