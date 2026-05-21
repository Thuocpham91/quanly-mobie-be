import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UserBranchRole } from './user-branch-role.entity';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  provinceId: number;

  @Column({ nullable: true })
  districtId: number;

  @Column({ nullable: true })
  wardId: number;

  @OneToMany(() => UserBranchRole, (ubr) => ubr.branch)
  userBranchRoles: UserBranchRole[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
