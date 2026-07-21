import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { UsersService } from '../users/users.service';


@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
    private usersService: UsersService,
  ) {}

  async findAll(branchId?: string, page: number = 1, limit: number = 10): Promise<PaginatedResult<Customer>> {
    const whereClause = branchId ? { branchId } : {};
    const skip = (page - 1) * limit;
    
    const [data, total] = await this.customersRepository.findAndCount({ 
      where: whereClause, 
      order: { createdAt: 'DESC' },
      skip,
      take: limit
    });
    
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async create(customerData: Partial<Customer>): Promise<Customer> {
    if (customerData.phone) {
      customerData.phone = customerData.phone.replace(/[^0-9]/g, '') || null;
    }
    if (customerData.phone) {
      const existing = await this.customersRepository.findOne({
        where: { phone: customerData.phone },
      });
      if (existing) {
        throw new BadRequestException('Số điện thoại khách hàng đã tồn tại trong hệ thống');
      }
    }
    if (customerData.code) {
      const existingByCode = await this.customersRepository.findOne({
        where: { code: customerData.code },
      });
      if (existingByCode) {
        throw new BadRequestException('Mã khách hàng đã tồn tại trong hệ thống');
      }
    }

    const customer = this.customersRepository.create(customerData);
    if (customerData.createdAt) {
      customer.createdAt = new Date(customerData.createdAt);
    }
    const savedCustomer = await this.customersRepository.save(customer);

    try {
      // Tự động tạo tài khoản cho khách hàng
      const userEmail = savedCustomer.email || `${savedCustomer.phone || savedCustomer.id}@noemail.local`;
      await this.usersService.create({
        fullName: savedCustomer.fullName,
        email: userEmail,
        phone: savedCustomer.phone || undefined,
        isActive: true,
        password: '$2b$10$V5Mc542SshfHxFZ8l/nUZOg/hhAlb.17a3eoaZJmq.N94Qk6phDX6', // Default '123456'
        sendEmail: false, // Do not send credentials email for customer users
      } as any);
    } catch (error) {
      console.error('Failed to auto-create user for customer:', error);
    }

    return savedCustomer;
  }

  async update(id: string, customerData: Partial<Customer>): Promise<Customer> {
    await this.findOne(id);
    if (customerData.phone !== undefined) {
      customerData.phone = customerData.phone ? customerData.phone.replace(/[^0-9]/g, '') : null;
      if (!customerData.phone) {
        customerData.phone = null;
      }
    }
    if (customerData.phone) {
      const existing = await this.customersRepository.findOne({
        where: { phone: customerData.phone },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Số điện thoại khách hàng đã tồn tại trong hệ thống');
      }
    }
    await this.customersRepository.update(id, customerData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    await this.customersRepository.remove(customer);
  }

  async search(query: string, branchId?: string, page: number = 1, limit: number = 10): Promise<PaginatedResult<Customer>> {
    const skip = (page - 1) * limit;
    const queryBuilder = this.customersRepository.createQueryBuilder('customer')
      .where('(customer.fullName ILIKE :query OR customer.phone ILIKE :query)', { query: `%${query}%` });
      
    if (branchId) {
      queryBuilder.andWhere('customer.branchId = :branchId', { branchId });
    }
    
    const [data, total] = await queryBuilder
      .orderBy('customer.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
      
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async topUpWallet(id: string, amount: number): Promise<Customer> {
    const customer = await this.findOne(id);
    const currentBalance = Number(customer.walletBalance) || 0;
    const newBalance = currentBalance + amount;
    if (newBalance < 0) {
      throw new Error('Số dư ví không đủ');
    }
    await this.customersRepository.update(id, { walletBalance: newBalance });
    return this.findOne(id);
  }

  async bulkCreate(customersData: Partial<Customer>[]): Promise<{ success: number; failed: any[] }> {
    let success = 0;
    const failed: any[] = [];
    for (const item of customersData) {
      try {
        if (item.phone) {
          const existing = await this.customersRepository.findOne({
            where: { phone: item.phone },
          });
          if (existing) {
            continue; // Skip creating if phone already exists
          }
        }
        if (item.code) {
          const existingByCode = await this.customersRepository.findOne({
            where: { code: item.code },
          });
          if (existingByCode) {
            continue; // Skip creating if code already exists
          }
        }
        await this.create(item);
        success++;
      } catch (error: any) {
        failed.push({
          fullName: item.fullName || 'N/A',
          phone: item.phone || 'N/A',
          reason: error.message || 'Lỗi không xác định',
        });
      }
    }
    return { success, failed };
  }

  async importExcel(fileBuffer: Buffer, branchId?: string): Promise<{ success: number; failed: any[] }> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet);

    const customersData: Partial<Customer>[] = rawData.map((row: any) => {
      const findValue = (keys: string[]) => {
        const foundKey = Object.keys(row).find(k => 
          keys.some(search => k.trim().toLowerCase().includes(search.toLowerCase()))
        );
        return foundKey ? String(row[foundKey] || '').trim() : '';
      };

      const fullName = findValue(['tên khách hàng', 'tên khá', 'họ tên', 'họ và tên', 'fullname', 'name']);
      const phoneRaw = findValue(['điện thoại', 'điện tho', 'số điện thoại', 'sđt', 'phone', 'sdt']);
      const address = findValue(['địa chỉ', 'address']);
      const email = findValue(['email']);
      const customerType = findValue(['loại khách hàng', 'loại kh', 'nhóm khách hàng', 'customertype']) || 'Khách lẻ';
      const notesRaw = findValue(['ghi chú', 'notes']);
      const customerCode = findValue(['mã khách hàng', 'mã kh', 'mã khá', 'customercode', 'mã']);
      const creator = findValue(['người tạo', 'creator', 'createdby', 'nguoi tao']);
      const branchName = findValue(['chi nhánh tạo', 'chi nhanh tao', 'branchname', 'branch name']);
      const deliveryArea = findValue(['khu vực giao hàng', 'khu vuc giao hang', 'deliveryarea', 'delivery area']);
      const ward = findValue(['phường/xã', 'phường xã', 'phuong xa', 'ward']);
      const company = findValue(['công ty', 'cong ty', 'company']);
      const taxCode = findValue(['mã số thuế', 'ma so thue', 'taxcode', 'tax code']);
      const identityNumber = findValue(['số cmnd/cccd', 'cmnd', 'cccd', 'identitynumber', 'identity number']);
      const birthDateRaw = findValue(['ngày sinh', 'ngay sinh', 'birthdate', 'birth date']);
      const gender = findValue(['giới tính', 'gioi tinh', 'gender']);
      const facebook = findValue(['facebook']);
      const status = findValue(['trạng thái', 'trang thai', 'status']);
      const totalSalesRaw = findValue(['tổng bán', 'tổng bán hàng', 'totalsales', 'tong ban']);
      const currentDebtRaw = findValue(['nợ cần thu hiện tại', 'nợ hiện tại', 'nợ', 'currentdebt', 'debt', 'no can thu']);
      const totalSalesMinusReturnsRaw = findValue(['tổng bán trừ trả hàng', 'tổng bán trừ trả', 'tong ban tru tra hang', 'salesminusreturns']);
      const transactionDateRaw = findValue(['ngày giao dịch', 'ngày tạo', 'ngày', 'transactiondate', 'createdat', 'date']);

      const phone = phoneRaw.replace(/[^0-9]/g, '') || null;
      let notes = notesRaw;
      if (customerCode) {
        notes = `[Mã KH: ${customerCode}]${notes ? ' ' + notes : ''}`;
      }

      let createdAt: Date | undefined;
      if (transactionDateRaw) {
        const parts = transactionDateRaw.split(/[\/\-.]/);
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            createdAt = date;
          }
        } else {
          const parsed = Date.parse(transactionDateRaw);
          if (!isNaN(parsed)) {
            createdAt = new Date(parsed);
          }
        }
      }

      const parseNumber = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        let str = String(val).trim();
        str = str.replace(/[₫$VNĐvnd]/gi, '').trim();

        if ((str.match(/\./g) || []).length > 1) {
          str = str.replace(/\./g, '');
        }
        if ((str.match(/,/g) || []).length > 1) {
          str = str.replace(/,/g, '');
        }

        if (str.includes(',') && str.includes('.')) {
          const commaIdx = str.indexOf(',');
          const dotIdx = str.indexOf('.');
          if (commaIdx > dotIdx) {
            str = str.replace(/\./g, '').replace(/,/g, '.');
          } else {
            str = str.replace(/,/g, '');
          }
        } else if (str.includes(',')) {
          const parts = str.split(',');
          if (parts.length === 2 && parts[1].length === 3) {
            str = str.replace(/,/g, '');
          } else {
            str = str.replace(/,/g, '.');
          }
        } else if (str.includes('.')) {
          const parts = str.split('.');
          if (parts.length === 2 && parts[1].length === 3) {
            str = str.replace(/\./g, '');
          }
        }

        const parsed = parseFloat(str);
        return isNaN(parsed) ? 0 : parsed;
      };

      const totalSales = parseNumber(totalSalesRaw);
      const currentDebt = parseNumber(currentDebtRaw);
      const totalSalesMinusReturns = parseNumber(totalSalesMinusReturnsRaw);

      let birthDate: Date | undefined;
      if (birthDateRaw) {
        const parts = birthDateRaw.split(/[\/\-.]/);
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            birthDate = date;
          }
        } else {
          const parsed = Date.parse(birthDateRaw);
          if (!isNaN(parsed)) {
            birthDate = new Date(parsed);
          }
        }
      }

      return {
        fullName,
        phone,
        address,
        email,
        customerType,
        notes,
        branchId,
        branchName: branchName || null,
        deliveryArea: deliveryArea || null,
        ward: ward || null,
        company: company || null,
        taxCode: taxCode || null,
        identityNumber: identityNumber || null,
        birthDate: birthDate || null,
        gender: gender || null,
        facebook: facebook || null,
        status: status || null,
        code: customerCode || null,
        creator: creator || null,
        totalSales,
        currentDebt,
        totalSalesMinusReturns,
        createdAt
      };
    });

    let success = 0;
    const failed: any[] = [];

    // Optimize DB query: fetch all existing phones in a single query
    const phones = customersData.map(c => c.phone).filter(Boolean) as string[];
    const codes = customersData.map(c => c.code).filter(Boolean) as string[];
    let existingPhonesSet = new Set<string>();
    let existingCodesSet = new Set<string>();
    if (phones.length > 0 || codes.length > 0) {
      const whereConditions: FindOptionsWhere<Customer>[] = [];
      if (phones.length > 0) {
        whereConditions.push({ phone: In(phones) });
      }
      if (codes.length > 0) {
        whereConditions.push({ code: In(codes) });
      }
      const existingCustomers = await this.customersRepository.find({
        where: whereConditions,
        select: ['phone', 'code']
      });
      existingPhonesSet = new Set(existingCustomers.map(c => c.phone).filter(Boolean) as string[]);
      existingCodesSet = new Set(existingCustomers.map(c => c.code).filter(Boolean) as string[]);
    }

    for (let i = 0; i < customersData.length; i++) {
      const item = customersData[i];
      const rowNum = i + 2; // Row 1 is header
      
      if (!item.fullName) {
        failed.push({ rowNum, fullName: 'N/A', phone: item.phone || 'N/A', reason: 'Thiếu tên khách hàng' });
        continue;
      }


      try {
        if (item.phone && existingPhonesSet.has(item.phone)) {
          continue; // Skip silently since it already exists in DB
        }
        if (item.code && existingCodesSet.has(item.code)) {
          continue; // Skip silently since code already exists in DB
        }
        await this.create(item);
        success++;
      } catch (error: any) {
        failed.push({
          rowNum,
          fullName: item.fullName,
          phone: item.phone || 'N/A',
          reason: error.message || 'Lỗi không xác định',
        });
      }
    }

    return { success, failed };
  }
}
