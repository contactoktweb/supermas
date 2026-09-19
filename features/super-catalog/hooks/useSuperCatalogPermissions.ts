'use client'

import { useMemo } from 'react'
import { superCatalogService } from '../services/super-catalog.service'
import { SuperCatalogPermission } from '../types'

export function useSuperCatalogPermissions(userRole: string = 'SUPERADMIN') {
  return useMemo(() => {
    const check = (perm: SuperCatalogPermission) =>
      superCatalogService.hasPermission(perm, userRole)

    return {
      canRead: check('super_catalog.read'),
      canUpdate: check('super_catalog.update'),
      canPublish: check('super_catalog.publish'),
      canPrice: check('super_catalog.price'),
      canImages: check('super_catalog.images'),
      canBulkUpdate: check('super_catalog.bulk_update'),
      canExport: check('super_catalog.export'),
    }
  }, [userRole])
}
