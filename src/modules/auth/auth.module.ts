import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './jwt.strategy';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { PermissionsSeedService } from './permissions-seed.service';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { PermissionsGuard } from './permissions.guard';
import { User } from '../users/entities/user.entity';
import { Branch } from '../branches/entities/branch.entity';
import { UserBranchRole } from '../branches/entities/user-branch-role.entity';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, User, Branch, UserBranchRole]),
    forwardRef(() => UsersModule),
    BranchesModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('SECRETKEY') || 'defaultSecret',
        signOptions: { 
          expiresIn: (configService.get<string>('EXPIRESIN') as any) || '1d' 
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, PermissionsSeedService, RolesService, PermissionsGuard],
  controllers: [AuthController, RolesController],
  exports: [AuthService, TypeOrmModule, RolesService, PermissionsGuard],
})
export class AuthModule {}
