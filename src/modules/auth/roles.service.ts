import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
  ) {}

  async findAll() {
    return this.roleRepo.find({ relations: ['permissions'] });
  }

  async findAllPermissions() {
    const permissions = await this.permissionRepo.find();
    // Group by module
    const grouped = permissions.reduce((acc, curr) => {
      if (!acc[curr.module]) {
        acc[curr.module] = [];
      }
      acc[curr.module].push(curr);
      return acc;
    }, {});
    return grouped;
  }

  async findOne(id: string) {
    const role = await this.roleRepo.findOne({ where: { id }, relations: ['permissions'] });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(data: { name: string; description?: string; permissionIds: string[] }) {
    const permissions = await this.permissionRepo.findBy({ id: In(data.permissionIds) });
    const role = this.roleRepo.create({
      name: data.name,
      description: data.description,
      permissions,
    });
    return this.roleRepo.save(role);
  }

  async update(id: string, data: { name?: string; description?: string; permissionIds?: string[] }) {
    const role = await this.findOne(id);
    if (data.name) role.name = data.name;
    if (data.description) role.description = data.description;
    if (data.permissionIds) {
      role.permissions = await this.permissionRepo.findBy({ id: In(data.permissionIds) });
    }
    return this.roleRepo.save(role);
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    return this.roleRepo.remove(role);
  }
}
