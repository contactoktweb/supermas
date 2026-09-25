import { db } from '@/lib/supabase'
import {
  Product,
  TaxRateConfig,
  ProductMovementSummary,
} from '../types'

export const TAX_CONFIGS_MOCK: TaxRateConfig[] = db.taxConfigs as unknown as TaxRateConfig[]
export const PRODUCT_CATEGORIES_MOCK: string[] = []
export const PRODUCT_BRANDS_MOCK: string[] = []
export const INITIAL_PRODUCTS_MOCK: Product[] = []
export const PRODUCT_MOVEMENTS_MOCK: Record<string, ProductMovementSummary[]> = {}
