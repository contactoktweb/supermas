/**
 * SUPER MÁS ERP/POS - Definiciones y Evaluadores de Reglas de Alerta
 *
 * Contiene la lógica analítica para evaluar el estado actual del ERP frente a
 * las reglas activas de supervisión sin duplicar alertas existentes.
 */

import { AlertRule, AlertItem, AlertPriority } from '../types'

export interface AlertCandidate {
  ruleId: string
  title: string
  description: string
  module: AlertRule['module']
  priority: AlertPriority
  entityType: AlertItem['entityType']
  entityId: string
  entityReference: string
  locationId?: string | null
  locationName?: string | null
  assignedRole?: string
  metadata?: Record<string, any>
}

export class AlertDefinitions {
  /**
   * Evalúa reglas de inventario sobre stock_levels y products
   */
  static evaluateInventory(params: {
    stockLevels: any[]
    products: any[]
    rules: AlertRule[]
  }): AlertCandidate[] {
    const candidates: AlertCandidate[] = []
    const outOfStockRule = params.rules.find((r) => r.id === 'rule-inv-001' && r.enabled)
    const lowStockRule = params.rules.find((r) => r.id === 'rule-inv-002' && r.enabled)

    if (!outOfStockRule && !lowStockRule) return candidates

    params.products.forEach((prod) => {
      const prodStocks = params.stockLevels.filter((s) => s.productId === prod.id)

      prodStocks.forEach((st) => {
        const currentStock =
          Number(st.currentStock) ||
          Number(st.quantity) ||
          Number(st.availableUnits) ||
          0
        const minStock =
          Number(st.minStock) ||
          Number(st.reorderPoint) ||
          Number(prod.minStockThreshold) ||
          (lowStockRule?.thresholds.defaultMinStock ?? 10)

        // 1. Regla Producto Agotado
        if (outOfStockRule && currentStock <= 0) {
          candidates.push({
            ruleId: outOfStockRule.id,
            title: `Producto Agotado: ${prod.name}`,
            description: `El producto ${prod.name} (SKU: ${prod.sku}) tiene 0 unidades en ${st.locationName || 'Bodega'}. Requiere reabastecimiento urgente.`,
            module: 'INVENTORY',
            priority: outOfStockRule.defaultPriority,
            entityType: 'PRODUCT',
            entityId: prod.id,
            entityReference: prod.sku || prod.barcode || prod.name,
            locationId: st.locationId,
            locationName: st.locationName,
            assignedRole: 'WAREHOUSE_ADMIN',
            metadata: {
              productId: prod.id,
              productName: prod.name,
              sku: prod.sku,
              currentStock: 0,
              minStock,
            },
          })
        }
        // 2. Regla Stock Bajo (si no está agotado)
        else if (lowStockRule && currentStock <= minStock) {
          candidates.push({
            ruleId: lowStockRule.id,
            title: `Stock Bajo: ${prod.name}`,
            description: `Existencias de ${prod.name} en nivel crítico (${currentStock} unidades disponibles frente al mínimo de ${minStock} en ${st.locationName || 'Bodega'}).`,
            module: 'INVENTORY',
            priority: lowStockRule.defaultPriority,
            entityType: 'PRODUCT',
            entityId: prod.id,
            entityReference: prod.sku || prod.name,
            locationId: st.locationId,
            locationName: st.locationName,
            assignedRole: 'WAREHOUSE_ADMIN',
            metadata: {
              productId: prod.id,
              productName: prod.name,
              sku: prod.sku,
              currentStock,
              minStock,
            },
          })
        }
      })
    })

    return candidates
  }

  /**
   * Evalúa vencimientos y plazos de facturas de compras a proveedores
   */
  static evaluatePurchases(params: {
    purchases: any[]
    rules: AlertRule[]
    now: Date
  }): AlertCandidate[] {
    const candidates: AlertCandidate[] = []
    const overdueRule = params.rules.find((r) => r.id === 'rule-pur-001' && r.enabled)
    const nearDueRule = params.rules.find((r) => r.id === 'rule-pur-002' && r.enabled)

    if (!overdueRule && !nearDueRule) return candidates

    const nowTime = params.now.getTime()
    const daysBeforeDue = nearDueRule?.thresholds.daysBeforeDue ?? 10

    params.purchases.forEach((pur) => {
      const pendingBalance = Number(pur.pendingBalance) || 0
      if (pendingBalance <= 0 || pur.status === 'PAID') return

      if (!pur.dueDate) return
      const dueTime = new Date(pur.dueDate).getTime()
      const diffDays = Math.ceil((dueTime - nowTime) / (1000 * 60 * 60 * 24))

      // Factura Vencida
      if (overdueRule && diffDays < 0) {
        candidates.push({
          ruleId: overdueRule.id,
          title: `Factura Proveedor Vencida: ${pur.supplierName}`,
          description: `La factura ${pur.supplierInvoiceNumber || pur.invoiceNumber || pur.purchaseNumber} de ${pur.supplierName} venció hace ${Math.abs(diffDays)} días con saldo pendiente de $${pendingBalance.toLocaleString('es-CO')} COP.`,
          module: 'PURCHASES',
          priority: overdueRule.defaultPriority,
          entityType: 'PURCHASE_INVOICE',
          entityId: pur.id,
          entityReference: pur.supplierInvoiceNumber || pur.purchaseNumber,
          locationId: pur.destinationLocationId || pur.locationId,
          locationName: pur.destinationLocationName || 'Bodega Principal',
          assignedRole: 'ACCOUNTANT',
          metadata: {
            supplierName: pur.supplierName,
            invoiceNumber: pur.supplierInvoiceNumber || pur.purchaseNumber,
            dueDate: pur.dueDate,
            daysOverdue: Math.abs(diffDays),
            pendingBalance,
          },
        })
      }
      // Factura Próxima a Vencer
      else if (nearDueRule && diffDays >= 0 && diffDays <= daysBeforeDue) {
        candidates.push({
          ruleId: nearDueRule.id,
          title: `Factura Próxima a Vencer: ${pur.supplierName}`,
          description: `La factura ${pur.supplierInvoiceNumber || pur.purchaseNumber} vence en ${diffDays} días (Fecha límite: ${pur.dueDate}). Saldo a programar: $${pendingBalance.toLocaleString('es-CO')} COP.`,
          module: 'PURCHASES',
          priority: nearDueRule.defaultPriority,
          entityType: 'PURCHASE_INVOICE',
          entityId: pur.id,
          entityReference: pur.supplierInvoiceNumber || pur.purchaseNumber,
          locationId: pur.destinationLocationId || pur.locationId,
          locationName: pur.destinationLocationName || 'Bodega Principal',
          assignedRole: 'ACCOUNTANT',
          metadata: {
            supplierName: pur.supplierName,
            invoiceNumber: pur.supplierInvoiceNumber || pur.purchaseNumber,
            dueDate: pur.dueDate,
            daysUntilDue: diffDays,
            pendingBalance,
          },
        })
      }
    })

    return candidates
  }

  /**
   * Evalúa incidencias de facturación electrónica DIAN
   */
  static evaluateInvoicing(params: {
    invoices: any[]
    rules: AlertRule[]
  }): AlertCandidate[] {
    const candidates: AlertCandidate[] = []
    const rejectedRule = params.rules.find((r) => r.id === 'rule-invc-001' && r.enabled)

    if (!rejectedRule) return candidates

    params.invoices.forEach((inv) => {
      if (inv.dianStatus === 'RECHAZADA_DIAN') {
        candidates.push({
          ruleId: rejectedRule.id,
          title: `Factura Electrónica Rechazada por DIAN: ${inv.invoiceNumber}`,
          description: `El documento fiscal ${inv.invoiceNumber} emitido a ${inv.customerName} fue rechazado por el validador DIAN. Requiere corrección y reenvío.`,
          module: 'INVOICING',
          priority: rejectedRule.defaultPriority,
          entityType: 'INVOICE',
          entityId: inv.id,
          entityReference: inv.invoiceNumber,
          locationId: inv.locationId,
          locationName: inv.locationName,
          assignedRole: 'ACCOUNTANT',
          metadata: {
            invoiceNumber: inv.invoiceNumber,
            customerName: inv.customerName,
            total: inv.total,
            dianStatus: inv.dianStatus,
          },
        })
      }
    })

    return candidates
  }

  /**
   * Evalúa anomalías en cajas registradoras (descuadres de arqueo y aperturas prolongadas)
   */
  static evaluateCashRegisters(params: {
    cashRegisters: any[]
    rules: AlertRule[]
    now: Date
  }): AlertCandidate[] {
    const candidates: AlertCandidate[] = []
    const diffRule = params.rules.find((r) => r.id === 'rule-cash-001' && r.enabled)
    const openHoursRule = params.rules.find((r) => r.id === 'rule-cash-002' && r.enabled)

    if (!diffRule && !openHoursRule) return candidates

    params.cashRegisters.forEach((cr) => {
      const diff = Number(cr.difference) || 0

      // 1. Diferencia en arqueo (Faltante o Sobrante)
      if (diffRule && diff !== 0) {
        const isFaltante = diff < 0
        candidates.push({
          ruleId: diffRule.id,
          title: `Diferencia de Arqueo en ${cr.name || cr.code}`,
          description: `Se registró un ${isFaltante ? 'faltante' : 'sobrante'} de $${Math.abs(diff).toLocaleString('es-CO')} COP en la caja ${cr.code} asignada a ${cr.cashierName || 'Cajero'}.`,
          module: 'CASH',
          priority: diffRule.defaultPriority,
          entityType: 'CASH_REGISTER',
          entityId: cr.id,
          entityReference: cr.code,
          locationId: cr.locationId,
          locationName: cr.locationName,
          assignedRole: 'CASHIER',
          metadata: {
            registerCode: cr.code,
            cashierName: cr.cashierName,
            expectedCash: cr.expectedCash,
            actualCash: cr.actualCash,
            difference: diff,
          },
        })
      }

      // 2. Caja abierta prolongadamente sin cierre
      if (openHoursRule && cr.status === 'OPEN' && cr.openedAt) {
        const openedTime = new Date(cr.openedAt).getTime()
        const hoursOpen = (params.now.getTime() - openedTime) / (1000 * 60 * 60)
        const maxHours = openHoursRule.thresholds.maxOpenHours ?? 14

        if (hoursOpen > maxHours) {
          candidates.push({
            ruleId: openHoursRule.id,
            title: `Caja Abierta Prolongada: ${cr.name || cr.code}`,
            description: `La caja ${cr.code} lleva ${Math.round(hoursOpen)} horas abierta continuamente sin corte de turno ni cierre de arqueo.`,
            module: 'CASH',
            priority: openHoursRule.defaultPriority,
            entityType: 'CASH_REGISTER',
            entityId: cr.id,
            entityReference: cr.code,
            locationId: cr.locationId,
            locationName: cr.locationName,
            assignedRole: 'CASHIER',
            metadata: {
              registerCode: cr.code,
              cashierName: cr.cashierName,
              openedAt: cr.openedAt,
              hoursOpen: Math.round(hoursOpen),
            },
          })
        }
      }
    })

    return candidates
  }

  /**
   * Evalúa pedidos web sin confirmar o con retraso
   */
  static evaluateWebOrders(params: {
    webOrders: any[]
    rules: AlertRule[]
    now: Date
  }): AlertCandidate[] {
    const candidates: AlertCandidate[] = []
    const pendingRule = params.rules.find((r) => r.id === 'rule-web-001' && r.enabled)

    if (!pendingRule) return candidates

    params.webOrders.forEach((ord) => {
      if (ord.status === 'PENDING') {
        const createdTime = new Date(ord.createdAt).getTime()
        const hoursPending = (params.now.getTime() - createdTime) / (1000 * 60 * 60)
        const maxHours = pendingRule.thresholds.maxHoursPending ?? 2

        if (hoursPending > maxHours) {
          candidates.push({
            ruleId: pendingRule.id,
            title: `Pedido Web sin Confirmación: ${ord.orderNumber}`,
            description: `La orden web ${ord.orderNumber} para ${ord.customerName} permanece en estado Pendiente desde hace más de ${Math.round(hoursPending)} horas.`,
            module: 'WEB_ORDERS',
            priority: pendingRule.defaultPriority,
            entityType: 'WEB_ORDER',
            entityId: ord.id,
            entityReference: ord.orderNumber,
            locationId: ord.assignedLocationId,
            locationName: ord.assignedLocationName || 'Bodega Principal (CEDI)',
            assignedRole: 'WAREHOUSE_ADMIN',
            metadata: {
              orderNumber: ord.orderNumber,
              customerName: ord.customerName,
              totalAmount: ord.totalAmount || ord.subtotal,
              hoursPending: Math.round(hoursPending),
            },
          })
        }
      }
    })

    return candidates
  }

  /**
   * Evalúa transferencias inter-bodegas estancadas en tránsito
   */
  static evaluateTransfers(params: {
    transfers: any[]
    rules: AlertRule[]
    now: Date
  }): AlertCandidate[] {
    const candidates: AlertCandidate[] = []
    const inTransitRule = params.rules.find((r) => r.id === 'rule-trans-001' && r.enabled)

    if (!inTransitRule) return candidates

    params.transfers.forEach((tr) => {
      if (tr.status === 'IN_TRANSIT') {
        const dispatchedTime = new Date(tr.dispatchedAt || tr.createdAt).getTime()
        const transitHours = (params.now.getTime() - dispatchedTime) / (1000 * 60 * 60)
        const maxHours = inTransitRule.thresholds.maxTransitHours ?? 24

        if (transitHours > maxHours) {
          candidates.push({
            ruleId: inTransitRule.id,
            title: `Traslado en Tránsito Demorado: ${tr.code}`,
            description: `La transferencia ${tr.code} de ${tr.originLocationName} a ${tr.destinationLocationName} lleva más de ${Math.round(transitHours)} horas en tránsito sin confirmación física en destino.`,
            module: 'TRANSFERS',
            priority: inTransitRule.defaultPriority,
            entityType: 'TRANSFER',
            entityId: tr.id,
            entityReference: tr.code,
            locationId: tr.destinationLocationId,
            locationName: tr.destinationLocationName,
            assignedRole: 'WAREHOUSE_ADMIN',
            metadata: {
              transferCode: tr.code,
              origin: tr.originLocationName,
              destination: tr.destinationLocationName,
              transitHours: Math.round(transitHours),
            },
          })
        }
      }
    })

    return candidates
  }

  /**
   * Evalúa asientos contables descuadrados (violación de partida doble)
   */
  static evaluateAccounting(params: {
    accountingEntries: any[]
    rules: AlertRule[]
  }): AlertCandidate[] {
    const candidates: AlertCandidate[] = []
    const unbalancedRule = params.rules.find((r) => r.id === 'rule-acc-001' && r.enabled)

    if (!unbalancedRule) return candidates

    params.accountingEntries.forEach((entry) => {
      let debits = 0
      let credits = 0
      entry.lines?.forEach((l: any) => {
        debits += Number(l.debit) || 0
        credits += Number(l.credit) || 0
      })

      const diff = Math.abs(debits - credits)
      if (diff > 0) {
        candidates.push({
          ruleId: unbalancedRule.id,
          title: `Asiento Contable Descuadrado: ${entry.entryNumber}`,
          description: `El comprobante contable ${entry.entryNumber} presenta un descuadre de $${diff.toLocaleString('es-CO')} COP (Débitos: $${debits.toLocaleString('es-CO')}, Créditos: $${credits.toLocaleString('es-CO')}).`,
          module: 'ACCOUNTING',
          priority: unbalancedRule.defaultPriority,
          entityType: 'ACCOUNTING_ENTRY',
          entityId: entry.id,
          entityReference: entry.entryNumber,
          locationId: entry.locationId,
          assignedRole: 'ACCOUNTANT',
          metadata: {
            entryNumber: entry.entryNumber,
            debits,
            credits,
            difference: diff,
          },
        })
      }
    })

    return candidates
  }
}
