import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';
import { Pet } from '../../pets/entities/pet.entity';

export enum CageStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  MAINTENANCE = 'MAINTENANCE',
  CHECKOUT = 'CHECKOUT',
  OVERDUE = 'OVERDUE',
  DEPOSITED = 'DEPOSITED',
}

@Entity('cages')
export class Cage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: CageStatus,
    default: CageStatus.AVAILABLE,
  })
  status: CageStatus;

  @Column({ nullable: true })
  notes: string;

  @Column()
  roomId: string;

  @ManyToOne(() => Room, (room) => room.cages, { onDelete: 'CASCADE' })
  room: Room;

  @Column({ nullable: true })
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'SET NULL', nullable: true })
  pet: Pet;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
