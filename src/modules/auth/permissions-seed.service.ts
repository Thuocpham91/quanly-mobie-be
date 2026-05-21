import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { User } from '../users/entities/user.entity';
import { Branch } from '../branches/entities/branch.entity';
import { UserBranchRole } from '../branches/entities/user-branch-role.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PermissionsSeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(UserBranchRole)
    private ubrRepo: Repository<UserBranchRole>,
  ) {}

  async onApplicationBootstrap() {
    console.log('--- STARTING PERMISSIONS & ADMIN SEED ---');
    try {
      await this.seedPermissions();
      await this.seedDefaultRoles();
      await this.seedAdminUser();
      console.log('--- SEEDING COMPLETED SUCCESSFULLY ---');
    } catch (error) {
      console.error('--- SEEDING FAILED ---', error);
    }
  }

  private async seedPermissions() {
    console.log('Seeding permissions...');
    const permissions = [
      // Hàng hóa, dịch vụ
      {
        name: 'products.view',
        displayName: 'Xem thông tin',
        module: 'Hàng hóa, dịch vụ',
      },
      {
        name: 'products.create_edit',
        displayName: 'Thêm, sửa thông tin',
        module: 'Hàng hóa, dịch vụ',
      },
      {
        name: 'products.delete',
        displayName: 'Xóa sản phẩm',
        module: 'Hàng hóa, dịch vụ',
      },

      // Người dùng
      { name: 'users.view', displayName: 'Xem nhân viên', module: 'Nhân viên' },
      {
        name: 'users.manage',
        displayName: 'Quản lý nhân viên',
        module: 'Nhân viên',
      },

      // Nhập hàng
      {
        name: 'inventory.import',
        displayName: 'Nhập hàng',
        module: 'Nhập hàng',
      },
      {
        name: 'inventory.edit_import',
        displayName: 'Chỉnh sửa đơn nhập hàng',
        module: 'Nhập hàng',
      },
      {
        name: 'inventory.cancel_import',
        displayName: 'Hủy đơn',
        module: 'Nhập hàng',
      },
      {
        name: 'inventory.view_recent_cost',
        displayName: 'Lấy giá nhập gần nhất',
        module: 'Nhập hàng',
      },

      // Khách hàng
      {
        name: 'customers.view',
        displayName: 'Khách hàng',
        module: 'Khách hàng',
      },
      {
        name: 'customers.delete',
        displayName: 'Xóa khách hàng',
        module: 'Khách hàng',
      },

      // Bán hàng
      { name: 'sales.create', displayName: 'Bán hàng', module: 'Bán hàng' },
      {
        name: 'sales.edit_date',
        displayName: 'Chỉnh sửa ngày bán',
        module: 'Bán hàng',
      },
      {
        name: 'sales.edit_discount',
        displayName: 'Chỉnh sửa giảm giá',
        module: 'Bán hàng',
      },
      {
        name: 'sales.edit_price',
        displayName: 'Chỉnh sửa đơn giá',
        module: 'Bán hàng',
      },
      { name: 'sales.payment', displayName: 'Thanh toán', module: 'Bán hàng' },
      { name: 'sales.exam', displayName: 'Khám bệnh', module: 'Bán hàng' },
      {
        name: 'sales.view_others',
        displayName: 'Xem đơn của người khác',
        module: 'Bán hàng',
      },
      {
        name: 'sales.sell_expired',
        displayName: 'Bán sản phẩm hết hạn',
        module: 'Bán hàng',
      },
      { name: 'sales.print_draft', displayName: 'In tạm', module: 'Bán hàng' },
      {
        name: 'sales.edit_seller',
        displayName: 'Chỉnh sửa người bán',
        module: 'Bán hàng',
      },

      // Thú cưng
      { name: 'pets.view', displayName: 'Thú cưng', module: 'Thú cưng' },
      { name: 'pets.delete', displayName: 'Xóa thú cưng', module: 'Thú cưng' },

      // Lịch sử giao dịch
      {
        name: 'history.view',
        displayName: 'Lịch sử bán hàng',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.view_others',
        displayName: 'Xem đơn của người khác',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.edit_order',
        displayName: 'Chỉnh sửa đơn hàng',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.view_others_review',
        displayName: 'Xem đánh giá của người khác',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.view_my_review',
        displayName: 'Xem đánh giá của tôi',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.delete_draft',
        displayName: 'Xóa đơn lưu tạm',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.view_exams',
        displayName: 'Lịch sử khám bệnh',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.edit_exam',
        displayName: 'Chỉnh sửa đơn hàng',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.view_vaccines',
        displayName: 'Lịch sử chủng ngừa',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.edit_vaccine',
        displayName: 'Chỉnh sửa đơn hàng',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.cancel_order',
        displayName: 'Hủy đơn',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.limit_days',
        displayName: 'Giới hạn X ngày',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.view_grooming',
        displayName: 'Lịch sử grooming',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.edit_grooming',
        displayName: 'Sửa grooming',
        module: 'Lịch sử giao dịch',
      },
      {
        name: 'history.view_boarding',
        displayName: 'Lịch sử lưu chuồng',
        module: 'Lịch sử giao dịch',
      },

      // Lưu chuồng
      {
        name: 'boarding.manage',
        displayName: 'Lưu chuồng',
        module: 'Lưu chuồng',
      },
      {
        name: 'boarding.payment',
        displayName: 'Tạm ứng',
        module: 'Lưu chuồng',
      },
      {
        name: 'boarding.view_health',
        displayName: 'Xem tình trạng sức khỏe',
        module: 'Lưu chuồng',
      },

      // Tạm ứng
      { name: 'advances.manage', displayName: 'Tạm ứng', module: 'Tạm ứng' },

      // Công nợ
      {
        name: 'debts.suppliers',
        displayName: 'Công nợ nhà cung cấp',
        module: 'Công nợ',
      },
      {
        name: 'debts.customers',
        displayName: 'Công nợ khách hàng',
        module: 'Công nợ',
      },
      {
        name: 'debts.edit_date',
        displayName: 'Chỉnh sửa ngày trả',
        module: 'Công nợ',
      },
    ];

    for (const p of permissions) {
      const exists = await this.permissionRepo.findOne({
        where: { name: p.name },
      });
      if (!exists) {
        await this.permissionRepo.save(this.permissionRepo.create(p));
      } else {
        exists.displayName = p.displayName;
        exists.module = p.module;
        await this.permissionRepo.save(exists);
      }
    }
  }

  private async seedDefaultRoles() {
    console.log('Seeding default roles...');
    const defaultRoles = [
      { name: 'Admin', description: 'Toàn quyền hệ thống' },
      { name: 'Vet', description: 'Bác sĩ thú y' },
      { name: 'Receptionist', description: 'Lễ tân' },
    ];

    const allPermissions = await this.permissionRepo.find();

    for (const r of defaultRoles) {
      const exists = await this.roleRepo.findOne({
        where: { name: r.name },
        relations: ['permissions'],
      });
      if (!exists) {
        const role = this.roleRepo.create(r);
        if (r.name === 'Admin') {
          role.permissions = allPermissions;
        }
        await this.roleRepo.save(role);
      } else if (r.name === 'Admin') {
        // Ensure Admin always has all permissions
        exists.permissions = allPermissions;
        await this.roleRepo.save(exists);
      }
    }
  }

  private async seedAdminUser() {
    console.log('Seeding admin user...');
    const email = 'admin@gmail.com';
    let admin = await this.userRepo.findOne({ where: { email } });

    if (!admin) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      admin = await this.userRepo.save(
        this.userRepo.create({
          email,
          password: hashedPassword,
          fullName: 'Default Admin',
          isActive: true,
        }),
      );
      console.log(`Created admin user: ${email}`);
    }

    const adminRole = await this.roleRepo.findOne({ where: { name: 'Admin' } });
    const branches = await this.branchRepo.find();

    if (adminRole && branches.length > 0) {
      for (const branch of branches) {
        const exists = await this.ubrRepo.findOne({
          where: { userId: admin.id, branchId: branch.id },
        });

        if (!exists) {
          await this.ubrRepo.save(
            this.ubrRepo.create({
              userId: admin.id,
              branchId: branch.id,
              roleId: adminRole.id,
            }),
          );
          console.log(
            `Assigned Admin role to ${email} in branch: ${branch.name}`,
          );
        }
      }
    }
  }
}
