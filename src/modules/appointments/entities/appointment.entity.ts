import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';

export enum AppointmentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: true })
  customer: Customer;

  @Column({ nullable: true })
  branchId: string;

  @ManyToOne('Branch', { nullable: true, onDelete: 'SET NULL' })
  branch: any;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  user: User;

  @Column({ type: 'timestamp' })
  dateTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDateTime: Date;

  @Column()
  purpose: string;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.PENDING,
  })
  status: AppointmentStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
