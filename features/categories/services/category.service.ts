import { categoryRepository } from '../repositories/category.repository'
import {
  Category,
  CategoryWithRelations,
  CategoryFilters,
  CategoryStats,
  CategoryDeleteCheck,
} from '../types'
import { categoryFormSchema, CategoryFormData } from '../schemas/category.schema'

export interface CategorySelectOption {
  value: string
  label: string
  level: number
  code?: string | null
}

export class CategoryService {
  async listCategories(
    filters?: CategoryFilters
  ): Promise<{ data: CategoryWithRelations[]; total: number }> {
    return categoryRepository.findAll(filters)
  }

  async getStats(): Promise<CategoryStats> {
    return categoryRepository.getStats()
  }

  async getCategory(id: string): Promise<CategoryWithRelations | null> {
    return categoryRepository.findById(id)
  }

  async createCategory(data: CategoryFormData, companyId?: string): Promise<Category> {
    const validated = categoryFormSchema.parse(data)
    return categoryRepository.create(validated, companyId)
  }

  async updateCategory(id: string, data: Partial<CategoryFormData>): Promise<Category> {
    // Si viene parentId igual a id, bloquear preventivamente
    if (data.parentId && data.parentId === id) {
      throw new Error('Una categoría no puede asignarse a sí misma como categoría padre.')
    }
    return categoryRepository.update(id, data)
  }

  async toggleCategoryActive(id: string, isActive: boolean): Promise<Category> {
    return categoryRepository.toggleActive(id, isActive)
  }

  async validateCategoryDeletion(id: string): Promise<CategoryDeleteCheck> {
    return categoryRepository.checkCanDelete(id)
  }

  async deleteCategory(id: string): Promise<void> {
    return categoryRepository.delete(id)
  }

  /**
   * Obtiene la lista ordenada de categorías disponibles para selectores de padre.
   * Excluye la categoría actual y todos sus descendientes para evitar referencias circulares.
   */
  async getParentSelectOptions(excludeId?: string): Promise<CategorySelectOption[]> {
    const { data: allCategories } = await categoryRepository.findAll({ sortBy: 'SORT_ORDER_ASC' })

    // Determinar descendientes de excludeId si existe
    const excludedIds = new Set<string>()
    if (excludeId) {
      excludedIds.add(excludeId)
      let foundNew = true
      while (foundNew) {
        foundNew = false
        for (const cat of allCategories) {
          if (cat.parentId && excludedIds.has(cat.parentId) && !excludedIds.has(cat.id)) {
            excludedIds.add(cat.id)
            foundNew = true
          }
        }
      }
    }

    return allCategories
      .filter((cat) => !excludedIds.has(cat.id))
      .map((cat) => ({
        value: cat.id,
        label: `${cat.level > 0 ? '— '.repeat(cat.level) : ''}${cat.name}`,
        level: cat.level,
        code: cat.code,
      }))
  }
}

export const categoryService = new CategoryService()
