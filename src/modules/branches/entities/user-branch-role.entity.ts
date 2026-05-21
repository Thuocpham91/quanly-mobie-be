import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Branch } from './branch.entity';
import { Role } from '../../auth/entities/role.entity';

@Entity('user_branch_roles')
export class UserBranchRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.userBranchRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  branchId: string;

  @ManyToOne(() => Branch, (branch) => branch.userBranchRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column()
  roleId: string;

  @ManyToOne(() => Role, (role) => role.userBranchRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
