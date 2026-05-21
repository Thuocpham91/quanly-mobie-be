import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Stocktake } from './stocktake.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('stocktake_items')
export class StocktakeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  stocktakeId: string;

  @ManyToOne(() => Stocktake, stocktake => stocktake.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stocktakeId' })
  stocktake: Stocktake;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int', default: 0 })
  systemQuantity: number;

  @Column({ type: 'int', default: 0 })
  actualQuantity: number;

  @Column({ type: 'int', default: 0 })
  difference: number;

  @Column({ nullable: true })
  reason: string;
}
