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

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Customer, (customer) => customer.pets, { onDelete: 'CASCADE' })
  owner: Customer;
}
