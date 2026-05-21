import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { InventoryTransferItem } from './inventory-transfer-item.entity';

export enum TransferStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('inventory_transfers')
export class InventoryTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  fromBranchId: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'fromBranchId' })
  fromBranch: Branch;

  @Column()
  toBranchId: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'toBranchId' })
  toBranch: Branch;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.PENDING,
  })
  status: TransferStatus;

  @Column({ nullable: true })
  note: string;

  @Column({ nullable: true })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ nullable: true })
  confirmedById: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmedById' })
  confirmedBy: User;

  @OneToMany(() => InventoryTransferItem, item => item.transfer, { cascade: true })
  items: InventoryTransferItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
