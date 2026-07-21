import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  walletBalance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: 'Khách lẻ' })
  customerType: string;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchName: string | null;

  @Column({ type: 'varchar', nullable: true })
  deliveryArea: string | null;

  @Column({ type: 'varchar', nullable: true })
  ward: string | null;

  @Column({ type: 'varchar', nullable: true })
  company: string | null;

  @Column({ type: 'varchar', nullable: true })
  taxCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  identityNumber: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  gender: string | null;

  @Column({ type: 'varchar', nullable: true })
  facebook: string | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

  @Column({ type: 'varchar', nullable: true })
  code: string | null;

  @Column({ type: 'varchar', nullable: true })
  creator: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalSales: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  currentDebt: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalSalesMinusReturns: number;

  @ManyToOne('Branch', 'customers', { nullable: true })
  branch: any; // Using string type for relation to avoid circular dependency issues if not imported
}
