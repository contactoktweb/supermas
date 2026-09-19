/**
 * SUPER MÁS ERP/POS - Servicio de Notificaciones (AlertNotificationService)
 *
 * Provee datos optimizados y filtrados para el centro de notificaciones (NotificationBell)
 * en el layout principal del sistema, sin sobrecargar la memoria del cliente.
 */

import { alertRepository } from '../repositories/alert.repository'
import { AlertItem, UserAlertContext } from '../types'

export class AlertNotificationService {
  /**
   * Obtiene las alertas más recientes pertinentes para el usuario actual
   */
  async getRecentAlerts(limit: number = 6, user?: UserAlertContext): Promise<AlertItem[]> {
    const { data } = await alertRepository.getAlerts({
      page: 1,
      pageSize: 25,
      onlyUnread: false,
    })

    // Filtrar según contexto de usuario si se proporciona
    let filtered = data
    if (user) {
      filtered = this.filterByUserScope(data, user)
    }

    return filtered.slice(0, limit)
  }

  /**
   * Obtiene el total de alertas pendientes/no leídas pertinentes
   */
  async getUnreadCount(user?: UserAlertContext): Promise<number> {
    const { data } = await alertRepository.getAlerts({
      page: 1,
      pageSize: 100,
      onlyUnread: true,
    })

    if (!user) return data.length
    return this.filterByUserScope(data, user).length
  }

  /**
   * Comprueba si existen alertas críticas activas
   */
  async hasCriticalAlerts(user?: UserAlertContext): Promise<boolean> {
    const { data } = await alertRepository.getAlerts({
      page: 1,
      pageSize: 50,
      onlyCritical: true,
    })

    const unclosed = data.filter((a) => !['RESOLVED', 'CLOSED'].includes(a.status))
    if (!user) return unclosed.length > 0
    return this.filterByUserScope(unclosed, user).length > 0
  }

  /**
   * Filtra las alertas según el rol y ubicación del usuario
   */
  private filterByUserScope(alerts: AlertItem[], user: UserAlertContext): AlertItem[] {
    if (user.role === 'SUPERADMIN' || user.permissions.includes('alerts.audit')) {
      return alerts
    }

    return alerts.filter((a) => {
      // 1. Asignadas directamente
      if (a.assignedUserId === user.userId) return true

      // 2. Rol específico
      if (user.role === 'CASHIER') {
        return a.module === 'CASH' || a.assignedRole === 'CASHIER'
      }

      if (user.role === 'WAREHOUSE_ADMIN') {
        if (user.locationId && a.locationId && a.locationId !== user.locationId) return false
        return ['INVENTORY', 'TRANSFERS', 'PURCHASES', 'WEB_ORDERS'].includes(a.module)
      }

      if (user.role === 'POINT_ADMIN') {
        if (user.locationId && a.locationId && a.locationId !== user.locationId) return false
        return ['SALES', 'CASH', 'INVOICING', 'INVENTORY'].includes(a.module)
      }

      if (user.role === 'ACCOUNTANT') {
        return ['ACCOUNTING', 'INVOICING', 'PURCHASES', 'CASH'].includes(a.module)
      }

      return true
    })
  }
}

export const alertNotificationService = new AlertNotificationService()
