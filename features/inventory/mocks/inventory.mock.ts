import { db } from '@/lib/supabase'
import { InventoryStockLevel } from '../types'

export const INVENTORY_STOCK_LEVELS_MOCK: InventoryStockLevel[] = db.stockLevels as unknown as InventoryStockLevel[]
