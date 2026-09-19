'use client'

/**
 * SUPER MÁS ERP/POS - Hook de Permisos de Catálogo Distribuidora
 */

import { useMemo } from 'react'
import { distributorCatalogService } from '../services/distributor-catalog.service'

export function useDistributorCatalogPermissions(userRole: string = 'SUPERADMIN') {
  return useMemo(() => {
    return {
      canRead: distributorCatalogService.hasPermission('distributor_catalog.read', userRole),
      canUpdate: distributorCatalogService.hasPermission('distributor_catalog.update', userRole),
      canPublish: distributorCatalogService.hasPermission('distributor_catalog.publish', userRole),
      canBulkUpdate: distributorCatalogService.hasPermission('distributor_catalog.bulk_update', userRole),
      canPreview: distributorCatalogService.hasPermission('distributor_catalog.preview', userRole),
      canExport: distributorCatalogService.hasPermission('distributor_catalog.export', userRole),
    }
  }, [userRole])
}
