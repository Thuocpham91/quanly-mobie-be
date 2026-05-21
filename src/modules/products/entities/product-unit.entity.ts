import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, DeleteDateColumn } from 'typeorm';
import { Product } from './product.entity';
import { Unit } from './unit.entity';

@Entity('product_units')
export class ProductUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, (product) => product.units, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  unitId: string;

  @ManyToOne(() => Unit)
  @JoinColumn({ name: 'unitId' })
  unit: Unit;

  @Column({ type: 'float', default: 1 })
  conversionFactor: number;

  @Column({ default: false })
  isDefault: boolean;
}
