import { db } from '@/lib/supabase'
import {
  Product,
  TaxRateConfig,
  ProductMovementSummary,
} from '../types'

export const TAX_CONFIGS_MOCK: TaxRateConfig[] = db.taxConfigs as unknown as TaxRateConfig[]
export const PRODUCT_CATEGORIES_MOCK: string[] = db.categories as unknown as string[]
export const PRODUCT_BRANDS_MOCK: string[] = db.brands as unknown as string[]
export const INITIAL_PRODUCTS_MOCK: Product[] = db.products as unknown as Product[]
export const PRODUCT_MOVEMENTS_MOCK: Record<string, ProductMovementSummary[]> = db.productMovements as unknown as Record<string, ProductMovementSummary[]>
