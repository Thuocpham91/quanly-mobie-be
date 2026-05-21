import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { Cage } from '../../cages/entities/cage.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  branch: Branch;

  // We will define the one-to-many relationship with Cages later
  @OneToMany('Cage', 'room')
  cages: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
