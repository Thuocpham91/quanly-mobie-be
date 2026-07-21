import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { Product } from './entities/product.entity';
import { ProductUnit } from './entities/product-unit.entity';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';


@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(isService?: boolean, page?: number, limit?: number): Promise<Product[] | PaginatedResult<Product>> {
    const whereClause: any = {};
    if (isService !== undefined) {
      whereClause.isService = isService;
    }

    const relations = ['category', 'itemGroup', 'classification', 'unit', 'units', 'units.unit', 'branchPrices', 'branchPrices.branch'];

    if (limit && limit > 0) {
      const pageNumber = Math.max(1, page ?? 1);
      const [data, total] = await this.productsRepository.findAndCount({
        where: whereClause,
        order: { name: 'ASC' },
        relations,
        skip: (pageNumber - 1) * limit,
        take: limit,
      });

      return {
        data,
        meta: {
          total,
          page: pageNumber,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    }

    return this.productsRepository.find({
      where: whereClause,
      order: { name: 'ASC' },
      relations,
    });
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({ 
      where: { id },
      relations: ['category', 'itemGroup', 'classification', 'unit', 'units', 'units.unit', 'branchPrices', 'branchPrices.branch']
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    if (createProductDto.imageUrls && createProductDto.imageUrls.length > 0) {
      if (!createProductDto.imageUrl) {
        createProductDto.imageUrl = createProductDto.imageUrls[0];
      }
    } else if (createProductDto.imageUrl) {
      createProductDto.imageUrls = [createProductDto.imageUrl];
    }

    const product = this.productsRepository.create(createProductDto);
    return this.productsRepository.save(product);
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);

    if (updateProductDto.imageUrls !== undefined) {
      if (updateProductDto.imageUrls && updateProductDto.imageUrls.length > 0) {
        updateProductDto.imageUrl = updateProductDto.imageUrls[0];
      } else {
        updateProductDto.imageUrl = undefined;
      }
    } else if (updateProductDto.imageUrl) {
      updateProductDto.imageUrls = [updateProductDto.imageUrl];
    }

    // Explicitly handle units to ensure TypeORM syncs them correctly
    const { units, ...rest } = updateProductDto;

    // Merge basic fields
    this.productsRepository.merge(product, rest);

    // If units are provided, update the relationship
    if (units) {
      product.units = units.map(u => {
        const productUnit = new ProductUnit();
        Object.assign(productUnit, u);
        productUnit.productId = id;
        return productUnit;
      });
    }

    return this.productsRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productsRepository.remove(product);
  }
}
