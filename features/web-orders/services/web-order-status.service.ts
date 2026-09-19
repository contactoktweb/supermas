/**
 * SUPER MÁS ERP/POS - Servicio de Máquina de Estados para Pedidos Web
 *
 * Controla el ciclo de vida, reglas de transición válidas, reservas de inventario
 * y validaciones obligatorias previas a cambios de estado.
 */

import { WebOrderStatus, WebOrder, WebOrderChecklist } from '../types'

export class WebOrderStatusService {
  /**
   * Mapa de transiciones legales permitidas según el flujo maestro del ERP:
   * Pendiente -> Confirmado -> Preparación -> Listo para despacho -> Enviado -> Entregado
   * Cancelado permitido únicamente desde Pendiente, Confirmado o Preparación.
   */
  private readonly ALLOWED_TRANSITIONS: Record<WebOrderStatus, WebOrderStatus[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY_TO_DISPATCH', 'CANCELLED'],
    READY_TO_DISPATCH: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
  }

  /**
   * Verifica si un cambio de estado es legal en el flujo.
   */
  canTransition(currentStatus: WebOrderStatus, targetStatus: WebOrderStatus): boolean {
    const validTargets = this.ALLOWED_TRANSITIONS[currentStatus] || []
    return validTargets.includes(targetStatus)
  }

  /**
   * Valida estrictamente la transición y lanza error explicativo si no es permitida.
   */
  assertTransition(currentStatus: WebOrderStatus, targetStatus: WebOrderStatus): void {
    if (!this.canTransition(currentStatus, targetStatus)) {
      throw new Error(
        `Transición no permitida: No se puede cambiar de '${this.getStatusLabel(
          currentStatus
        )}' a '${this.getStatusLabel(targetStatus)}'.`
      )
    }
  }

  /**
   * Valida si el checklist de alistamiento está 100% completado.
   */
  validateChecklist(checklist?: WebOrderChecklist): { isValid: boolean; missing: string[] } {
    const missing: string[] = []
    if (!checklist) {
      return {
        isValid: false,
        missing: [
          'Revisión de productos',
          'Verificación de cantidades',
          'Confirmación de cliente',
          'Confirmación de dirección',
          'Verificación de pago',
        ],
      }
    }

    if (!checklist.itemsReviewed) missing.push('Revisión de productos')
    if (!checklist.quantitiesVerified) missing.push('Verificación de cantidades')
    if (!checklist.customerConfirmed) missing.push('Confirmación de cliente')
    if (!checklist.addressConfirmed) missing.push('Confirmación de dirección')
    if (!checklist.paymentVerified) missing.push('Verificación de pago')

    return {
      isValid: missing.length === 0,
      missing,
    }
  }

  /**
   * Obtiene la etiqueta en español para visualización del estado.
   */
  getStatusLabel(status: WebOrderStatus): string {
    const labels: Record<WebOrderStatus, string> = {
      PENDING: 'Pendiente',
      CONFIRMED: 'Confirmado',
      PREPARING: 'En Preparación',
      READY_TO_DISPATCH: 'Listo para Despacho',
      SHIPPED: 'Enviado',
      DELIVERED: 'Entregado',
      CANCELLED: 'Cancelado',
    }
    return labels[status] || status
  }

  /**
   * Determina si el pedido tiene inventario reservado en bodega.
   */
  hasInventoryReservation(order: WebOrder): boolean {
    return ['CONFIRMED', 'PREPARING', 'READY_TO_DISPATCH'].includes(order.status)
  }
}

export const webOrderStatusService = new WebOrderStatusService()
