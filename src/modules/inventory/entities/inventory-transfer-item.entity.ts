import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { InventoryTransfer } from './inventory-transfer.entity';

@Entity('inventory_transfer_items')
export class InventoryTransferItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  transferId: string;

  @ManyToOne(() => InventoryTransfer, transfer => transfer.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transferId' })
  transfer: InventoryTransfer;

  @Column()
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  costPrice: number;

  @Column({ nullable: true })
  expiryDate: Date;

  @Column({ nullable: true })
  invoiceName: string;
}
