/**
 * SUPER MÁS ERP/POS — Tipos del Dominio de Categorías
 * Conectado exclusivamente a public.categories y public.products en PostgreSQL/Supabase.
 */

export interface Category {
  id: string
  companyId: string
  parentId: string | null
  name: string
  slug: string
  code: string | null
  description: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CategoryWithRelations extends Category {
  parentName?: string | null
  childrenCount: number
  productsCount: number
  level: number
  path?: string
}

export interface CategoryStats {
  totalCategories: number
  activeCategories: number
  inactiveCategories: number
  rootCategories: number
  subcategories: number
}

export type CategorySortOption =
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'CODE_ASC'
  | 'SORT_ORDER_ASC'
  | 'CREATED_DESC'

export interface CategoryFilters {
  query?: string
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE'
  parentId?: 'ALL' | 'ROOT' | string
  sortBy?: CategorySortOption
  page?: number
  pageSize?: number
}

export interface CategoryDeleteCheck {
  canDelete: boolean
  reason?: string
  associatedProductsCount: number
  childCategoriesCount: number
}
