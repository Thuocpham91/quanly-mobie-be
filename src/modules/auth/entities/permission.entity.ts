import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany } from 'typeorm';
import { Role } from './role.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // e.g. 'products.delete'

  @Column()
  displayName: string; // e.g. 'Xóa sản phẩm'

  @Column()
  module: string; // e.g. 'Hàng hóa, dịch vụ'

  @Column({ nullable: true })
  description: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
