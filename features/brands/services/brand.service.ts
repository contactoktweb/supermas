import { brandRepository } from '../repositories/brand.repository'
import {
  Brand,
  BrandWithRelations,
  BrandFilters,
  BrandStats,
  BrandDeleteCheck,
} from '../types'
import { brandFormSchema, BrandFormData } from '../schemas/brand.schema'

export interface BrandSelectOption {
  value: string
  label: string
}

export class BrandService {
  async listBrands(
    filters?: BrandFilters
  ): Promise<{ data: BrandWithRelations[]; total: number }> {
    return brandRepository.findAll(filters)
  }

  async getStats(): Promise<BrandStats> {
    return brandRepository.getStats()
  }

  async getBrand(id: string): Promise<BrandWithRelations | null> {
    return brandRepository.findById(id)
  }

  async createBrand(data: BrandFormData, companyId?: string): Promise<Brand> {
    const validated = brandFormSchema.parse(data)
    return brandRepository.create(validated, companyId)
  }

  async updateBrand(id: string, data: Partial<BrandFormData>): Promise<Brand> {
    return brandRepository.update(id, data)
  }

  async toggleBrandActive(id: string, isActive: boolean): Promise<Brand> {
    return brandRepository.toggleActive(id, isActive)
  }

  async validateBrandDeletion(id: string): Promise<BrandDeleteCheck> {
    return brandRepository.checkCanDelete(id)
  }

  async deleteBrand(id: string): Promise<void> {
    return brandRepository.delete(id)
  }

  async getSelectOptions(): Promise<BrandSelectOption[]> {
    const { data: allBrands } = await brandRepository.findAll({ status: 'ACTIVE' })
    return allBrands.map((b) => ({
      value: b.id,
      label: b.name,
    }))
  }
}

export const brandService = new BrandService()
