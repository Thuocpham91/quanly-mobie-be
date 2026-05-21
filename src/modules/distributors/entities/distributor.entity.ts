import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { InventoryBatch } from '../../inventory/entities/inventory-batch.entity';

@Entity('distributors')
export class Distributor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => InventoryBatch, batch => batch.distributor)
  batches: InventoryBatch[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
