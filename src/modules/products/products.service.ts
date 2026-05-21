import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductUnit } from './entities/product-unit.entity';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';


@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(isService?: boolean): Promise<Product[]> {
    const whereClause: any = {};
    if (isService !== undefined) {
      whereClause.isService = isService;
    }

    return this.productsRepository.find({
      where: whereClause,
      order: { name: 'ASC' },
      relations: ['category', 'itemGroup', 'classification', 'unit', 'units', 'units.unit', 'branchPrices', 'branchPrices.branch']
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
    const product = this.productsRepository.create(createProductDto);
    return this.productsRepository.save(product);
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    
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
