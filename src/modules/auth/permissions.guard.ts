import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { UserBranchRole } from '../branches/entities/user-branch-role.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    @InjectRepository(UserBranchRole)
    private userBranchRoleRepo: Repository<UserBranchRole>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const branchId = request.headers['x-branch-id'];

    this.logger.debug(`Checking permissions for user: ${user?.email}, branch: ${branchId}, required: ${requiredPermissions}`);

    if (!user) {
      return false;
    }

    // Master Admin bypass - case insensitive
    if (user.email?.toLowerCase() === 'admin@gmail.com') {
      this.logger.log(`Master Admin bypass for ${user.email}`);
      return true;
    }

    // Admin has all permissions (fallback if needed, or based on role name)
    // Here we check specifically for the role and its permissions in the current branch
    
    const userBranchRole = await this.userBranchRoleRepo.findOne({
      where: { userId: user.id || user.sub, branchId: branchId as string },
      relations: ['role', 'role.permissions'],
    });

    if (!userBranchRole) {
      this.logger.warn(`No role found for user ${user.email} in branch ${branchId}`);
      throw new ForbiddenException('Bạn không có quyền truy cập chi nhánh này');
    }

    const userPermissions = userBranchRole.role.permissions.map(p => p.name);

    // Special case for Admin role name
    if (userBranchRole.role.name === 'Admin') {
      return true;
    }

    const hasPermission = requiredPermissions.every(permission => userPermissions.includes(permission));

    if (!hasPermission) {
      throw new ForbiddenException('Bạn không có quyền thực hiện hành động này');
    }

    return true;
  }
}
