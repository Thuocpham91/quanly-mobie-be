import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { AuthModule } from '../auth/auth.module';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    MailModule,
    forwardRef(() => AuthModule),
    BranchesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
