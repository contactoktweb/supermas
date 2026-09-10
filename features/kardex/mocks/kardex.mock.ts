import { db } from '@/lib/supabase'
import { InventoryMovement } from '../types'

export const INVENTORY_MOVEMENTS_MOCK: InventoryMovement[] = db.inventoryMovements as unknown as InventoryMovement[]
