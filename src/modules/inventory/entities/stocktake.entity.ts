import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { StocktakeItem } from './stocktake-item.entity';

export enum StocktakeStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('stocktakes')
export class Stocktake {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  branchId: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({
    type: 'enum',
    enum: StocktakeStatus,
    default: StocktakeStatus.PENDING,
  })
  status: StocktakeStatus;

  @Column({ nullable: true })
  note: string;

  @Column({ nullable: true })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ nullable: true })
  approvedById: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approvedById' })
  approvedBy: User;

  @OneToMany(() => StocktakeItem, item => item.stocktake, { cascade: true })
  items: StocktakeItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
