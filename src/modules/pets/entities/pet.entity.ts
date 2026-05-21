import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';

export enum PetGender {
  MALE = 'male',
  FEMALE = 'female',
  UNKNOWN = 'unknown',
}

@Entity('pets')
export class Pet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  species: string; // e.g., Dog, Cat

  @Column({ nullable: true })
  breed: string;

  @Column({
    type: 'enum',
    enum: PetGender,
    default: PetGender.UNKNOWN,
  })
  gender: PetGender;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ type: 'float', nullable: true })
  weight: number;

  @Column({ nullable: true })
  barcode: string;

  @Column({ default: 'years' })
  ageType: string;

  @Column({ type: 'int', nullable: true })
  ageYears: number;

  @Column({ type: 'int', nullable: true })
  ageMonths: number;

  @Column({ type: 'int', nullable: true })
  ageDays: number;

  @Column({ nullable: true })
  furColor: string;

  @Column({ nullable: true })
  neutered: string;

  @Column({ default: false })
  isCrossBreed: boolean;

  @Column({ nullable: true })
  habitat: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Customer, (customer) => customer.pets, { onDelete: 'CASCADE' })
  owner: Customer;

  @Column({ nullable: true })
  branchId: string;

  @ManyToOne('Branch', 'pets', { nullable: true })
  branch: any; // Using string type for relation to avoid circular dependency
}
