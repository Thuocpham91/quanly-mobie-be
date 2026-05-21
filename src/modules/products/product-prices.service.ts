import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductBranchPrice } from './entities/product-branch-price.entity';
import { Product } from './entities/product.entity';
import { Branch } from '../branches/entities/branch.entity';
import { UpdateProductBranchPriceDto } from './dto/product-price.dto';

@Injectable()
export class ProductPricesService {
  constructor(
    @InjectRepository(ProductBranchPrice)
    private readonly productBranchPriceRepository: Repository<ProductBranchPrice>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) {}

  async getPricesForProduct(productId: string) {
    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const branchPrices = await this.productBranchPriceRepository.find({
      where: { productId },
      relations: ['branch'],
    });

    return branchPrices;
  }

  async setBranchPrice(productId: string, branchId: string, dto: UpdateProductBranchPriceDto) {
    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const branch = await this.branchRepository.findOne({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
    }

    let branchPrice = await this.productBranchPriceRepository.findOne({
      where: { productId, branchId },
    });

    if (branchPrice) {
      branchPrice.price = dto.price;
    } else {
      branchPrice = this.productBranchPriceRepository.create({
        productId,
        branchId,
        price: dto.price,
      });
    }

    return this.productBranchPriceRepository.save(branchPrice);
  }

  async deleteBranchPrice(productId: string, branchId: string) {
    const result = await this.productBranchPriceRepository.delete({ productId, branchId });
    if (result.affected === 0) {
      throw new NotFoundException(`Price override not found for product ${productId} in branch ${branchId}`);
    }
    return { success: true };
  }
}
