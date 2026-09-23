import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
  ) {}

  async findAll(page = 1, limit = 10): Promise<PaginatedResult<Category>> {
    const pageNumber = Math.max(1, page);
    const [data, total] = await this.categoriesRepository.findAndCount({
      order: { name: 'ASC' },
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

  async findOne(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = this.categoriesRepository.create(createCategoryDto);
    return this.categoriesRepository.save(category);
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    await this.findOne(id);
    await this.categoriesRepository.update(id, updateCategoryDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoriesRepository.remove(category);
  }
}
