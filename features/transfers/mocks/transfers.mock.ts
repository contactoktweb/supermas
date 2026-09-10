import { db } from '@/lib/supabase'
import { Transfer, TransferLocationOption, ProductAvailabilityForTransfer } from '../types'

export const TRANSFER_LOCATIONS_MOCK: TransferLocationOption[] = db.transferLocations as unknown as TransferLocationOption[]
export const TRANSFERS_MOCK: Transfer[] = db.transfers as unknown as Transfer[]
export const AVAILABLE_PRODUCTS_FOR_TRANSFER: ProductAvailabilityForTransfer[] = db.transferAvailability as unknown as ProductAvailabilityForTransfer[]
