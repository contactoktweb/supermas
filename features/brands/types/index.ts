/**
 * SUPER MÁS ERP/POS — Tipos del Dominio de Marcas
 * Conectado exclusivamente a public.brands y public.products en PostgreSQL/Supabase.
 */

export interface Brand {
  id: string
  companyId: string
  name: string
  slug: string
  logoUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface BrandWithRelations extends Brand {
  productsCount: number
}

export interface BrandStats {
  totalBrands: number
  activeBrands: number
  inactiveBrands: number
  brandsWithProducts: number
}

export type BrandSortOption =
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'PRODUCTS_DESC'
  | 'CREATED_DESC'

export interface BrandFilters {
  query?: string
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE'
  sortBy?: BrandSortOption
  page?: number
  pageSize?: number
}

export interface BrandDeleteCheck {
  canDelete: boolean
  reason?: string
  associatedProductsCount: number
}
