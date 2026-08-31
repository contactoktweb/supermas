'use client'

import { useMemo } from 'react'

export type UserRoleType = 'SUPERADMIN' | 'STORE_ADMIN' | 'POINT_ADMIN' | 'SELLER' | 'INVENTORY_CLERK'

export interface WarehousePermissions {
  canReadWarehouse: boolean
  canCreateWarehouse: boolean
  canEditWarehouse: boolean
  canDeactivateWarehouse: boolean
  canReadInventory: boolean
  canReadCost: boolean
  canAdjustStock: boolean
  canTransferStock: boolean
  canManageUsers: boolean
  canReadSales: boolean
  canReadPurchases: boolean
}

export function useWarehousePermissions(role: UserRoleType = 'SUPERADMIN'): WarehousePermissions {
  return useMemo(() => {
    switch (role) {
      case 'SUPERADMIN':
        return {
          canReadWarehouse: true,
          canCreateWarehouse: true,
          canEditWarehouse: true,
          canDeactivateWarehouse: true,
          canReadInventory: true,
          canReadCost: true,
          canAdjustStock: true,
          canTransferStock: true,
          canManageUsers: true,
          canReadSales: true,
          canReadPurchases: true,
        }
      case 'STORE_ADMIN':
        return {
          canReadWarehouse: true,
          canCreateWarehouse: false,
          canEditWarehouse: true,
          canDeactivateWarehouse: false,
          canReadInventory: true,
          canReadCost: true,
          canAdjustStock: true,
          canTransferStock: true,
          canManageUsers: true,
          canReadSales: true,
          canReadPurchases: true,
        }
      case 'POINT_ADMIN':
        return {
          canReadWarehouse: true,
          canCreateWarehouse: false,
          canEditWarehouse: false,
          canDeactivateWarehouse: false,
          canReadInventory: true,
          canReadCost: false,
          canAdjustStock: true,
          canTransferStock: true,
          canManageUsers: false,
          canReadSales: true,
          canReadPurchases: false,
        }
      case 'INVENTORY_CLERK':
        return {
          canReadWarehouse: true,
          canCreateWarehouse: false,
          canEditWarehouse: false,
          canDeactivateWarehouse: false,
          canReadInventory: true,
          canReadCost: false,
          canAdjustStock: true,
          canTransferStock: true,
          canManageUsers: false,
          canReadSales: false,
          canReadPurchases: false,
        }
      case 'SELLER':
      default:
        return {
          canReadWarehouse: true,
          canCreateWarehouse: false,
          canEditWarehouse: false,
          canDeactivateWarehouse: false,
          canReadInventory: true,
          canReadCost: false,
          canAdjustStock: false,
          canTransferStock: false,
          canManageUsers: false,
          canReadSales: true,
          canReadPurchases: false,
        }
    }
  }, [role])
}
