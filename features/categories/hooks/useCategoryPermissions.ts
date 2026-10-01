'use client'

import { useMemo } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'

export interface CategoryPermissions {
  canRead: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canToggleActive: boolean
}

export function useCategoryPermissions(): CategoryPermissions {
  const { user, hasPermission } = useAuth()

  return useMemo(() => {
    const isSuperAdmin = user?.roleCode === 'SUPERADMIN'
    const isAdmin = user?.roleCode === 'ADMIN'

    const canRead = isSuperAdmin || isAdmin || hasPermission('products.read')
    const canCreate = isSuperAdmin || isAdmin || hasPermission('products.create')
    const canEdit = isSuperAdmin || isAdmin || hasPermission('products.update')
    const canDelete = isSuperAdmin || isAdmin || hasPermission('products.delete')

    return {
      canRead,
      canCreate,
      canEdit,
      canDelete,
      canToggleActive: canEdit,
    }
  }, [user, hasPermission])
}
