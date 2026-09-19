/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Pedidos Web
 *
 * Conecta el ecommerce con el ERP administrativo. Gestiona el ciclo de vida completo
 * del pedido web: validación de disponibilidad, confirmación administrativa,
 * alistamiento/preparación con checklist, reserva y salida de inventario,
 * generación de venta, emisión de facturación electrónica DIAN y auditoría transversal.
 */

import { webOrderRepository } from '../repositories/web-order.repository'
import { webOrderStatusService } from './web-order-status.service'
import { auditService } from '@/features/audit/services/audit.service'
import {
  WebOrder,
  WebOrderFilters,
  WebOrderPaginatedResult,
  WebOrderStats,
  WebOrderPermission,
  WebOrderChecklist,
  InventoryCheckResult,
} from '../types'
import {
  webOrderChecklistSchema,
  webOrderDispatchSchema,
  webOrderCancellationSchema,
} from '../schemas/web-order.schema'

export interface UserContext {
  id: string
  name: string
  role: string
  locationId?: string
}

const DEFAULT_ADMIN_USER: UserContext = {
  id: 'user-01',
  name: 'Laura Gómez',
  role: 'SUPERADMIN',
  locationId: 'loc-001',
}

const ROLE_PERMISSIONS: Record<string, WebOrderPermission[]> = {
  SUPERADMIN: [
    'web_orders.read',
    'web_orders.confirm',
    'web_orders.prepare',
    'web_orders.dispatch',
    'web_orders.cancel',
    'web_orders.invoice',
    'web_orders.export',
  ],
  WAREHOUSE_ADMIN: [
    'web_orders.read',
    'web_orders.confirm',
    'web_orders.prepare',
    'web_orders.dispatch',
    'web_orders.cancel',
    'web_orders.export',
  ],
  POINT_ADMIN: [
    'web_orders.read',
    'web_orders.confirm',
    'web_orders.prepare',
    'web_orders.dispatch',
    'web_orders.export',
  ],
  ACCOUNTANT: [
    'web_orders.read',
    'web_orders.invoice',
    'web_orders.export',
  ],
  SELLER: ['web_orders.read'],
  CASHIER: ['web_orders.read'],
}

export class WebOrderService {
  /**
   * Valida si un rol de usuario posee un permiso operativo específico.
   */
  hasPermission(permission: WebOrderPermission, userRole: string = 'SUPERADMIN'): boolean {
    const allowed = ROLE_PERMISSIONS[userRole] || []
    return allowed.includes(permission)
  }

  private assertPermission(permission: WebOrderPermission, user: UserContext): void {
    if (!this.hasPermission(permission, user.role)) {
      throw new Error(
        `Permiso denegado: Se requiere el permiso '${permission}' para ejecutar esta acción en Pedidos Web.`
      )
    }
  }

  /**
   * Consulta listado de pedidos web aplicando filtros, búsqueda y paginación.
   */
  async getOrders(
    filters: WebOrderFilters = {},
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<WebOrderPaginatedResult> {
    this.assertPermission('web_orders.read', user)
    return webOrderRepository.findAll(filters)
  }

  /**
   * Obtiene un pedido específico por su ID.
   */
  async getOrderById(id: string, user: UserContext = DEFAULT_ADMIN_USER): Promise<WebOrder | null> {
    this.assertPermission('web_orders.read', user)
    return webOrderRepository.findById(id)
  }

  /**
   * Obtiene las métricas para los KPI Cards del dashboard.
   */
  async getStats(user: UserContext = DEFAULT_ADMIN_USER): Promise<WebOrderStats> {
    this.assertPermission('web_orders.read', user)
    return webOrderRepository.getStats()
  }

  /**
   * Valida la disponibilidad de los productos consultando stock_levels en todas las bodegas.
   */
  async checkAvailability(
    items: { productId: string; quantity: number }[]
  ): Promise<InventoryCheckResult[]> {
    return webOrderRepository.checkStockAvailability(items)
  }

  /**
   * Confirma administrativamente un pedido recién llegado (PENDING -> CONFIRMED).
   * Valida disponibilidad de inventario y establece la reserva formal de stock.
   */
  async confirmOrder(orderId: string, user: UserContext = DEFAULT_ADMIN_USER): Promise<WebOrder> {
    this.assertPermission('web_orders.confirm', user)

    const order = await webOrderRepository.findById(orderId)
    if (!order) {
      throw new Error(`El pedido con ID ${orderId} no existe.`)
    }

    // Validar transición legal
    webOrderStatusService.assertTransition(order.status, 'CONFIRMED')

    // Validar disponibilidad de inventario
    const availability = await this.checkAvailability(
      order.items.map((it) => ({ productId: it.productId, quantity: it.quantity }))
    )
    const hasOut = availability.some((a) => a.availability === 'OUT_OF_STOCK')
    if (hasOut) {
      throw new Error(
        'No se puede confirmar el pedido: Uno o más productos se encuentran agotados en bodega.'
      )
    }

    const now = new Date().toISOString()
    const updated = await webOrderRepository.update(orderId, {
      status: 'CONFIRMED',
      assignedUserId: user.id,
      assignedUserName: user.name,
      timeline: [
        ...order.timeline,
        {
          status: 'CONFIRMED',
          timestamp: now,
          actor: user.name,
          notes: 'Pedido confirmado administrativamente. Reserva de inventario en Bodega Principal activada.',
        },
      ],
    })

    // Registrar en auditoría transversal
    await auditService.log({
      action: 'WEB_ORDER_CONFIRMED',
      module: 'WEB_ORDERS',
      entityType: 'WEB_ORDER',
      entityId: order.id,
      entityReference: order.orderNumber,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: order.assignedLocationId,
      locationName: order.assignedLocationName,
      level: 'INFO',
      details: `Pedido web ${order.orderNumber} confirmado por ${user.name}. Reserva de stock activa.`,
      changes: [
        {
          field: 'status',
          label: 'Estado del Pedido',
          previousValue: order.status,
          newValue: 'CONFIRMED',
        },
      ],
    })

    return updated
  }

  /**
   * Pasa el pedido al estado de alistamiento / preparación (CONFIRMED -> PREPARING).
   */
  async startPreparation(orderId: string, user: UserContext = DEFAULT_ADMIN_USER): Promise<WebOrder> {
    this.assertPermission('web_orders.prepare', user)

    const order = await webOrderRepository.findById(orderId)
    if (!order) throw new Error(`El pedido ${orderId} no existe.`)

    webOrderStatusService.assertTransition(order.status, 'PREPARING')

    const now = new Date().toISOString()
    const updated = await webOrderRepository.update(orderId, {
      status: 'PREPARING',
      assignedUserId: user.id,
      assignedUserName: user.name,
      timeline: [
        ...order.timeline,
        {
          status: 'PREPARING',
          timestamp: now,
          actor: user.name,
          notes: 'Inicio de alistamiento y picking de productos en bodega.',
        },
      ],
    })

    await auditService.log({
      action: 'WEB_ORDER_PREPARED',
      module: 'WEB_ORDERS',
      entityType: 'WEB_ORDER',
      entityId: order.id,
      entityReference: order.orderNumber,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: order.assignedLocationId,
      locationName: order.assignedLocationName,
      level: 'INFO',
      details: `Inicio de preparación de pedido ${order.orderNumber}.`,
      changes: [
        {
          field: 'status',
          label: 'Estado del Pedido',
          previousValue: order.status,
          newValue: 'PREPARING',
        },
      ],
    })

    return updated
  }

  /**
   * Guarda el checklist de preparación completado y pasa el pedido a LISTO PARA DESPACHO.
   */
  async completePreparationChecklist(
    orderId: string,
    checklistData: WebOrderChecklist,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<WebOrder> {
    this.assertPermission('web_orders.prepare', user)

    const order = await webOrderRepository.findById(orderId)
    if (!order) throw new Error(`El pedido ${orderId} no existe.`)

    // Validar esquema Zod
    webOrderChecklistSchema.parse(checklistData)

    const now = new Date().toISOString()
    const fullChecklist: WebOrderChecklist = {
      ...checklistData,
      completedAt: now,
      completedBy: user.name,
    }

    webOrderStatusService.assertTransition(order.status, 'READY_TO_DISPATCH')

    const updated = await webOrderRepository.update(orderId, {
      status: 'READY_TO_DISPATCH',
      checklist: fullChecklist,
      timeline: [
        ...order.timeline,
        {
          status: 'READY_TO_DISPATCH',
          timestamp: now,
          actor: user.name,
          notes: 'Checklist de alistamiento 100% verificado. Pedido embalado y listo para despacho.',
        },
      ],
    })

    await auditService.log({
      action: 'WEB_ORDER_PREPARED',
      module: 'WEB_ORDERS',
      entityType: 'WEB_ORDER',
      entityId: order.id,
      entityReference: order.orderNumber,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: order.assignedLocationId,
      locationName: order.assignedLocationName,
      level: 'INFO',
      details: `Preparación de pedido ${order.orderNumber} completada por ${user.name}.`,
      changes: [
        {
          field: 'status',
          label: 'Estado del Pedido',
          previousValue: order.status,
          newValue: 'READY_TO_DISPATCH',
        },
      ],
    })

    return updated
  }

  /**
   * Despacha el pedido al transportador (READY_TO_DISPATCH -> SHIPPED).
   * Genera el registro de Venta oficial en sales.json y descuenta el inventario físico.
   */
  async dispatchOrder(
    orderId: string,
    dispatchData: { courier: string; trackingNumber: string; deliveryNotes?: string },
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<WebOrder> {
    this.assertPermission('web_orders.dispatch', user)

    const parsed = webOrderDispatchSchema.parse(dispatchData)
    const order = await webOrderRepository.findById(orderId)
    if (!order) throw new Error(`El pedido ${orderId} no existe.`)

    webOrderStatusService.assertTransition(order.status, 'SHIPPED')

    // Generar la venta oficial en el ERP vinculada al pedido web
    const { saleId, saleNumber } = await webOrderRepository.createSaleFromWebOrder(order, {
      id: user.id,
      name: user.name,
    })

    const now = new Date().toISOString()
    const updated = await webOrderRepository.update(orderId, {
      status: 'SHIPPED',
      courier: parsed.courier,
      trackingNumber: parsed.trackingNumber,
      deliveryNotes: parsed.deliveryNotes || order.deliveryNotes,
      saleId,
      saleNumber,
      timeline: [
        ...order.timeline,
        {
          status: 'SHIPPED',
          timestamp: now,
          actor: user.name,
          notes: `Mercancía entregada a transportadora ${parsed.courier}. Guía: ${parsed.trackingNumber}. Venta ${saleNumber} generada en el sistema.`,
        },
      ],
    })

    await auditService.log({
      action: 'WEB_ORDER_DISPATCHED',
      module: 'WEB_ORDERS',
      entityType: 'WEB_ORDER',
      entityId: order.id,
      entityReference: order.orderNumber,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: order.assignedLocationId,
      locationName: order.assignedLocationName,
      level: 'INFO',
      details: `Pedido ${order.orderNumber} despachado con guía ${parsed.trackingNumber} (${parsed.courier}). Venta asociada: ${saleNumber}.`,
      changes: [
        {
          field: 'status',
          label: 'Estado del Pedido',
          previousValue: order.status,
          newValue: 'SHIPPED',
        },
        {
          field: 'trackingNumber',
          label: 'Número de Guía',
          previousValue: order.trackingNumber || 'Ninguno',
          newValue: parsed.trackingNumber,
        },
      ],
    })

    return updated
  }

  /**
   * Marca el pedido como entregado a satisfacción al cliente (SHIPPED -> DELIVERED).
   */
  async deliverOrder(
    orderId: string,
    notes?: string,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<WebOrder> {
    const order = await webOrderRepository.findById(orderId)
    if (!order) throw new Error(`El pedido ${orderId} no existe.`)

    webOrderStatusService.assertTransition(order.status, 'DELIVERED')

    const now = new Date().toISOString()
    const updated = await webOrderRepository.update(orderId, {
      status: 'DELIVERED',
      timeline: [
        ...order.timeline,
        {
          status: 'DELIVERED',
          timestamp: now,
          actor: user.name,
          notes: notes || 'Pedido entregado a satisfacción en destino.',
        },
      ],
    })

    await auditService.log({
      action: 'WEB_ORDER_DELIVERED',
      module: 'WEB_ORDERS',
      entityType: 'WEB_ORDER',
      entityId: order.id,
      entityReference: order.orderNumber,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: order.assignedLocationId,
      locationName: order.assignedLocationName,
      level: 'INFO',
      details: `Pedido web ${order.orderNumber} marcado como entregado a satisfacción.`,
      changes: [
        {
          field: 'status',
          label: 'Estado del Pedido',
          previousValue: order.status,
          newValue: 'DELIVERED',
        },
      ],
    })

    return updated
  }

  /**
   * Genera la Factura Electrónica legal DIAN para el pedido web.
   * Regla de negocio: No permite duplicar facturas si ya existe una emitida.
   */
  async generateInvoice(orderId: string, user: UserContext = DEFAULT_ADMIN_USER): Promise<WebOrder> {
    this.assertPermission('web_orders.invoice', user)

    const order = await webOrderRepository.findById(orderId)
    if (!order) throw new Error(`El pedido ${orderId} no existe.`)

    if (order.status === 'CANCELLED') {
      throw new Error('No es posible emitir factura para un pedido cancelado.')
    }

    if (order.invoiceId) {
      throw new Error(`Este pedido ya cuenta con factura electrónica emitida (${order.invoiceNumber}).`)
    }

    // Si aún no tiene venta generada, crearla primero
    let saleId = order.saleId
    let saleNumber = order.saleNumber
    if (!saleId) {
      const saleResult = await webOrderRepository.createSaleFromWebOrder(order, {
        id: user.id,
        name: user.name,
      })
      saleId = saleResult.saleId
      saleNumber = saleResult.saleNumber
    }

    // Generar la factura en invoices.json
    const { invoiceId, invoiceNumber } = await webOrderRepository.createInvoiceFromWebOrder(
      order,
      saleId,
      { id: user.id, name: user.name }
    )

    const now = new Date().toISOString()
    const updated = await webOrderRepository.update(orderId, {
      saleId,
      saleNumber,
      invoiceId,
      invoiceNumber,
      dianStatus: 'VALIDADA_DIAN',
      timeline: [
        ...order.timeline,
        {
          status: order.status,
          timestamp: now,
          actor: user.name,
          notes: `Factura Electrónica ${invoiceNumber} generada y validada ante la DIAN.`,
        },
      ],
    })

    await auditService.log({
      action: 'INVOICE_ISSUED',
      module: 'INVOICING',
      entityType: 'INVOICE',
      entityId: invoiceId,
      entityReference: invoiceNumber,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: order.assignedLocationId,
      locationName: order.assignedLocationName,
      level: 'INFO',
      details: `Factura electrónica ${invoiceNumber} emitida para el pedido web ${order.orderNumber}.`,
      changes: [
        {
          field: 'invoiceNumber',
          label: 'Número de Factura',
          previousValue: 'Sin Factura',
          newValue: invoiceNumber,
        },
      ],
    })

    return updated
  }

  /**
   * Cancela un pedido web registrando motivo obligatorio y liberando reservas de stock.
   */
  async cancelOrder(
    orderId: string,
    reason: string,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<WebOrder> {
    this.assertPermission('web_orders.cancel', user)

    const parsed = webOrderCancellationSchema.parse({ reason })
    const order = await webOrderRepository.findById(orderId)
    if (!order) throw new Error(`El pedido ${orderId} no existe.`)

    webOrderStatusService.assertTransition(order.status, 'CANCELLED')

    const hadReservation = webOrderStatusService.hasInventoryReservation(order)
    const now = new Date().toISOString()

    const updated = await webOrderRepository.update(orderId, {
      status: 'CANCELLED',
      cancellationReason: parsed.reason,
      cancelledAt: now,
      cancelledBy: user.name,
      timeline: [
        ...order.timeline,
        {
          status: 'CANCELLED',
          timestamp: now,
          actor: user.name,
          notes: `Pedido cancelado. Motivo: ${parsed.reason}.${
            hadReservation ? ' Reserva de inventario liberada con éxito.' : ''
          }`,
        },
      ],
    })

    await auditService.log({
      action: 'WEB_ORDER_CANCELLED',
      module: 'WEB_ORDERS',
      entityType: 'WEB_ORDER',
      entityId: order.id,
      entityReference: order.orderNumber,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: order.assignedLocationId,
      locationName: order.assignedLocationName,
      level: 'WARNING',
      details: `Pedido web ${order.orderNumber} cancelado por ${user.name}. Motivo: ${parsed.reason}`,
      changes: [
        {
          field: 'status',
          label: 'Estado del Pedido',
          previousValue: order.status,
          newValue: 'CANCELLED',
        },
        {
          field: 'cancellationReason',
          label: 'Motivo de Cancelación',
          previousValue: 'N/A',
          newValue: parsed.reason,
        },
      ],
    })

    return updated
  }

  /**
   * Exporta los pedidos filtrados a formato CSV descargable.
   */
  async exportOrdersToCsv(
    filters: WebOrderFilters = {},
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<string> {
    this.assertPermission('web_orders.export', user)

    const { orders } = await webOrderRepository.findAll({ ...filters, page: 1, pageSize: 5000 })

    const headers = [
      'Numero_Pedido',
      'Fecha',
      'Canal',
      'Estado',
      'Cliente',
      'Documento',
      'Telefono',
      'Ciudad',
      'Items',
      'Unidades',
      'Total',
      'Metodo_Pago',
      'Estado_Pago',
      'Bodega_Salida',
      'Factura',
      'Guia_Despacho',
      'Transportadora',
    ]

    const rows = orders.map((o) => [
      `"${o.orderNumber}"`,
      `"${o.createdAt}"`,
      `"${o.channel}"`,
      `"${o.status}"`,
      `"${o.customerName.replace(/"/g, '""')}"`,
      `"${o.customerDoc || ''}"`,
      `"${o.customerPhone}"`,
      `"${o.city}"`,
      o.itemsCount,
      o.totalUnits,
      o.totalAmount,
      `"${o.paymentMethod}"`,
      `"${o.paymentStatus}"`,
      `"${o.assignedLocationName}"`,
      `"${o.invoiceNumber || 'PENDIENTE'}"`,
      `"${o.trackingNumber || ''}"`,
      `"${o.courier || ''}"`,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }
}

export const webOrderService = new WebOrderService()
