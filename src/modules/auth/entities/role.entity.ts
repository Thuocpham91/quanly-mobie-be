import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { Permission } from './permission.entity';
import { UserBranchRole } from '../../branches/entities/user-branch-role.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @ManyToMany(() => Permission, (permission) => permission.roles)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'roleId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' }
  })
  permissions: Permission[];

  @OneToMany(() => UserBranchRole, (userBranchRole) => userBranchRole.role)
  userBranchRoles: UserBranchRole[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
