import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';
import { Customer } from '../../customers/entities/customer.entity';

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

  @Column()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  pet: Pet;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  customer: Customer;

  @Column({ nullable: true })
  branchId: string;

  @ManyToOne('Branch', { nullable: true, onDelete: 'SET NULL' })
  branch: any;

  @Column({ type: 'timestamp' })
  dateTime: Date;

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
