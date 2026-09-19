'use client'

/**
 * SUPER MÁS ERP/POS - Hook de Permisos de Pedidos Web
 *
 * Facilita el control de permisos a nivel de interfaz de usuario
 * según el rol del usuario conectado.
 */

import { useMemo } from 'react'
import { webOrderService } from '../services/web-order.service'

export function useWebOrderPermissions(userRole: string = 'SUPERADMIN') {
  return useMemo(() => {
    return {
      canRead: webOrderService.hasPermission('web_orders.read', userRole),
      canConfirm: webOrderService.hasPermission('web_orders.confirm', userRole),
      canPrepare: webOrderService.hasPermission('web_orders.prepare', userRole),
      canDispatch: webOrderService.hasPermission('web_orders.dispatch', userRole),
      canCancel: webOrderService.hasPermission('web_orders.cancel', userRole),
      canInvoice: webOrderService.hasPermission('web_orders.invoice', userRole),
      canExport: webOrderService.hasPermission('web_orders.export', userRole),
    }
  }, [userRole])
}
