import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  walletBalance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Pet, (pet) => pet.owner)
  pets: Pet[];

  @Column({ default: 'Khách lẻ' })
  customerType: string;

  @Column({ nullable: true })
  branchId: string;

  @ManyToOne('Branch', 'customers', { nullable: true })
  branch: any; // Using string type for relation to avoid circular dependency issues if not imported
}
