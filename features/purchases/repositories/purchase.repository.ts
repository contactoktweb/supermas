import { db } from '@/lib/supabase'
import {
  Purchase,
  PurchaseFilterParams,
  PurchaseStats,
  ReceivePurchaseInput,
  RegisterPaymentInput,
  PurchasePayment,
} from '../types'
import { costService } from '../services/cost.service'

export class PurchaseRepository {
  private purchases: Purchase[] = [...(db.purchases as unknown as Purchase[])]

  async findAll(params: PurchaseFilterParams): Promise<{ data: Purchase[]; total: number }> {
    let filtered = [...this.purchases]

    // 1. Text Search (purchaseNumber, supplierInvoiceNumber, supplierName, supplierNit, notes, createdBy)
    if (params.query && params.query.trim()) {
      const q = params.query.trim().toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.purchaseNumber.toLowerCase().includes(q) ||
          p.supplierInvoiceNumber.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q) ||
          p.supplierNit.includes(q) ||
          (p.notes && p.notes.toLowerCase().includes(q)) ||
          p.createdByUserName.toLowerCase().includes(q) ||
          p.items.some((i) => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
      )
    }

    // 2. Supplier filter
    if (params.supplierId && params.supplierId !== 'ALL') {
      filtered = filtered.filter((p) => p.supplierId === params.supplierId)
    }

    // 3. Destination Location filter
    if (params.locationId && params.locationId !== 'ALL') {
      filtered = filtered.filter((p) => p.destinationLocationId === params.locationId)
    }

    // 4. Status filter
    if (params.status && params.status !== 'ALL') {
      filtered = filtered.filter((p) => p.status === params.status)
    }

    // 5. Payment Type filter
    if (params.paymentType && params.paymentType !== 'ALL') {
      filtered = filtered.filter((p) => p.paymentType === params.paymentType)
    }

    // 6. Date Range filter
    if (params.startDate) {
      filtered = filtered.filter((p) => new Date(p.date) >= new Date(params.startDate!))
    }
    if (params.endDate) {
      filtered = filtered.filter((p) => new Date(p.date) <= new Date(params.endDate!))
    }

    // 7. Sort
    const sortField = params.sortField || 'date'
    const sortDir = params.sortDirection || 'desc'
    filtered.sort((a, b) => {
      let valA: any = a[sortField as keyof Purchase]
      let valB: any = b[sortField as keyof Purchase]

      if (sortField === 'date' || sortField === 'createdAt') {
        valA = new Date(valA).getTime()
        valB = new Date(valB).getTime()
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    const total = filtered.length
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const start = (page - 1) * pageSize
    const paginated = filtered.slice(start, start + pageSize)

    return {
      data: paginated,
      total,
    }
  }

  async findById(id: string): Promise<Purchase | null> {
    const found = this.purchases.find((p) => p.id === id)
    return found ? JSON.parse(JSON.stringify(found)) : null
  }

  async create(purchase: Purchase): Promise<Purchase> {
    const copy = JSON.parse(JSON.stringify(purchase))
    this.purchases.unshift(copy)

    // Registrar en auditoría
    const auditLog = {
      id: `aud-${Date.now()}`,
      action: 'PURCHASE_CREATED',
      locationId: purchase.destinationLocationId,
      locationName: purchase.destinationLocationName,
      userId: purchase.createdByUserId,
      userName: purchase.createdByUserName,
      timestamp: 'Justo ahora',
      changes: {
        purchaseNumber: purchase.purchaseNumber,
        supplierName: purchase.supplierName,
        total: purchase.total,
        status: purchase.status,
      },
    }
    ;(db.auditLogs as unknown as any[]).unshift(auditLog)

    return copy
  }

  async update(id: string, updates: Partial<Purchase>): Promise<Purchase> {
    const index = this.purchases.findIndex((p) => p.id === id)
    if (index === -1) throw new Error(`Compra no encontrada (ID: ${id})`)

    this.purchases[index] = {
      ...this.purchases[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    return JSON.parse(JSON.stringify(this.purchases[index]))
  }

  /**
   * Proceso transaccional de Recepción Física de Mercancía:
   * 1. Valida estado.
   * 2. Por cada producto:
   *    - Consulta saldo y costo previo.
   *    - Calcula nuevo costo promedio ponderado vía costService.
   *    - Aumenta existencias en stock_levels.
   *    - Genera movimiento Kardex inmutable en inventory_movements (tipo COMPRA).
   *    - Actualiza costo promedio en catálogo de productos.
   * 3. Actualiza estado de la compra a RECEIVED (o PAYMENT_PENDING/PAID).
   * 4. Registra auditoría.
   */
  async receive(
    id: string,
    receptionData: ReceivePurchaseInput,
    user: { id: string; name: string }
  ): Promise<Purchase> {
    const index = this.purchases.findIndex((p) => p.id === id)
    if (index === -1) throw new Error(`Compra no encontrada (ID: ${id})`)

    const purchase = this.purchases[index]

    if (purchase.status === 'RECEIVED' || purchase.status === 'PAID') {
      throw new Error('Esta compra ya ha sido recibida previamente')
    }
    if (purchase.status === 'CANCELLED') {
      throw new Error('No se puede recibir una compra que fue anulada')
    }

    const locationId = purchase.destinationLocationId
    const nowIso = new Date().toISOString()

    // 1. Procesar cada ítem recibido
    for (const item of purchase.items) {
      // Buscar o inicializar stock_level para (productId, locationId)
      const stockLevels = db.stockLevels as unknown as any[]
      let stockEntry = stockLevels.find(
        (s) => s.productId === item.productId && s.locationId === locationId
      )

      const prevStock = stockEntry ? stockEntry.currentStock : 0
      const prevCost = stockEntry ? stockEntry.averageCost : item.unitCost

      // Calcular nuevo costo promedio ponderado
      const costResult = costService.calculateWeightedAverageCost({
        currentStock: prevStock,
        currentAverageCost: prevCost,
        incomingQuantity: item.quantity,
        incomingUnitCost: item.unitCost,
      }) as import('../services/cost.service').CostCalculationResult

      const resultingStock = costResult.resultingStock
      const newAverageCost = costResult.newAverageCost

      if (stockEntry) {
        stockEntry.currentStock = resultingStock
        stockEntry.averageCost = newAverageCost
        stockEntry.totalValueAtCost = Math.round(resultingStock * newAverageCost)
        stockEntry.lastMovementAt = nowIso
        stockEntry.lastMovementType = 'COMPRA'
        stockEntry.lastMovementDoc = purchase.supplierInvoiceNumber
        stockEntry.stockHealth =
          resultingStock <= 0
            ? 'OUT_OF_STOCK'
            : resultingStock <= (stockEntry.criticalStock || 10)
            ? 'CRITICAL'
            : resultingStock <= (stockEntry.minStock || 20)
            ? 'LOW_STOCK'
            : 'AVAILABLE'
      } else {
        stockEntry = {
          id: `stk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          barcode: item.barcode || '',
          category: 'Abarrotes y Despensa',
          brand: 'General',
          unitOfMeasure: item.unitOfMeasure,
          locationId,
          locationName: purchase.destinationLocationName,
          locationCode: purchase.destinationLocationCode,
          currentStock: resultingStock,
          minStock: 20,
          criticalStock: 10,
          reorderPoint: 30,
          averageCost: newAverageCost,
          totalValueAtCost: Math.round(resultingStock * newAverageCost),
          stockHealth: 'AVAILABLE',
          lastMovementAt: nowIso,
          lastMovementType: 'COMPRA',
          lastMovementDoc: purchase.supplierInvoiceNumber,
        }
        stockLevels.push(stockEntry)
      }

      // Actualizar costo y stock en catálogo maestro de productos
      const products = db.products as unknown as any[]
      const prodMaster = products.find((p) => p.id === item.productId)
      if (prodMaster) {
        prodMaster.averageCost = newAverageCost
        prodMaster.totalStock = (prodMaster.totalStock || 0) + item.quantity
        prodMaster.availableUnits = (prodMaster.availableUnits || 0) + item.quantity
        prodMaster.inventoryValueAtCost = Math.round(prodMaster.totalStock * newAverageCost)
      }

      // Generar movimiento Kardex inmutable
      const kardexMov = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        movementNumber: `MOV-${Date.now().toString().slice(-6)}`,
        createdAt: nowIso,
        movementDate: nowIso,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        barcode: item.barcode || '',
        locationId,
        locationName: purchase.destinationLocationName,
        locationCode: purchase.destinationLocationCode,
        type: 'COMPRA',
        movementType: 'COMPRA',
        documentType: 'COMPRA',
        documentRef: purchase.purchaseNumber,
        sourceDocumentType: 'PURCHASE_INVOICE',
        sourceDocumentId: purchase.id,
        sourceDocumentNumber: purchase.supplierInvoiceNumber,
        quantity: item.quantity,
        quantityIn: item.quantity,
        quantityOut: 0,
        quantityDelta: item.quantity,
        previousStock: prevStock,
        resultingStock,
        unitCost: item.unitCost,
        averageCostAfter: newAverageCost,
        totalCost: item.subtotal,
        totalValue: item.subtotal,
        userId: user.id,
        userName: user.name,
        notes: `Entrada física por recepción de compra ${purchase.purchaseNumber} (Factura proveedor: ${purchase.supplierInvoiceNumber})`,
      }
      ;(db.inventoryMovements as unknown as any[]).unshift(kardexMov)

      // Marcar cantidad recibida en la línea
      item.receivedQuantity = item.quantity
    }

    // 2. Determinar nuevo estado comercial
    let nextStatus: Purchase['status'] = 'RECEIVED'
    if (purchase.paymentType === 'CONTADO' || purchase.pendingBalance <= 0) {
      nextStatus = 'PAID'
    } else {
      nextStatus = 'PAYMENT_PENDING'
    }

    // 3. Actualizar registro de la compra
    this.purchases[index] = {
      ...purchase,
      status: nextStatus,
      receptionInfo: {
        receivedAt: nowIso,
        receivedByUserId: user.id,
        receivedByUserName: user.name,
        notes: receptionData.notes || 'Mercancía recibida en bodega',
      },
      updatedAt: nowIso,
    }

    // 4. Auditoría
    const auditLog = {
      id: `aud-${Date.now()}`,
      action: 'PURCHASE_RECEIVED',
      locationId: purchase.destinationLocationId,
      locationName: purchase.destinationLocationName,
      userId: user.id,
      userName: user.name,
      timestamp: 'Justo ahora',
      changes: {
        purchaseNumber: purchase.purchaseNumber,
        itemsReceived: purchase.items.length,
        status: nextStatus,
      },
    }
    ;(db.auditLogs as unknown as any[]).unshift(auditLog)

    return JSON.parse(JSON.stringify(this.purchases[index]))
  }

  /**
   * Registro de Abono o Pago a Proveedor (Cuentas por Pagar)
   */
  async registerPayment(
    input: RegisterPaymentInput,
    user: { id: string; name: string }
  ): Promise<Purchase> {
    const index = this.purchases.findIndex((p) => p.id === input.purchaseId)
    if (index === -1) throw new Error(`Compra no encontrada (ID: ${input.purchaseId})`)

    const purchase = this.purchases[index]

    if (purchase.status === 'CANCELLED') {
      throw new Error('No se puede registrar pagos a una compra anulada')
    }
    if (purchase.pendingBalance <= 0) {
      throw new Error('Esta compra ya se encuentra totalmente pagada')
    }
    if (input.amount > purchase.pendingBalance) {
      throw new Error(
        `El valor a pagar ($${input.amount.toLocaleString()}) supera el saldo pendiente ($${purchase.pendingBalance.toLocaleString()})`
      )
    }

    const nowIso = new Date().toISOString()
    const newPayment: PurchasePayment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      purchaseId: purchase.id,
      date: nowIso,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      reference: input.reference,
      notes: input.notes,
      registeredByUserId: user.id,
      registeredByUserName: user.name,
      createdAt: nowIso,
    }

    const newPaidAmount = purchase.paidAmount + input.amount
    const newPendingBalance = Math.max(0, purchase.total - newPaidAmount)
    const newStatus =
      newPendingBalance === 0
        ? 'PAID'
        : purchase.status === 'RECEIVED' || purchase.status === 'PAYMENT_PENDING'
        ? 'PAYMENT_PENDING'
        : purchase.status

    this.purchases[index] = {
      ...purchase,
      paidAmount: newPaidAmount,
      pendingBalance: newPendingBalance,
      status: newStatus,
      payments: [...purchase.payments, newPayment],
      updatedAt: nowIso,
    }

    // Auditoría
    const auditLog = {
      id: `aud-${Date.now()}`,
      action: 'PURCHASE_PAYMENT_REGISTERED',
      locationId: purchase.destinationLocationId,
      locationName: purchase.destinationLocationName,
      userId: user.id,
      userName: user.name,
      timestamp: 'Justo ahora',
      changes: {
        purchaseNumber: purchase.purchaseNumber,
        paymentAmount: input.amount,
        remainingBalance: newPendingBalance,
        status: newStatus,
      },
    }
    ;(db.auditLogs as unknown as any[]).unshift(auditLog)

    return JSON.parse(JSON.stringify(this.purchases[index]))
  }

  /**
   * Anulación de Compra
   */
  async cancel(
    id: string,
    reason: string,
    user: { id: string; name: string }
  ): Promise<Purchase> {
    const index = this.purchases.findIndex((p) => p.id === id)
    if (index === -1) throw new Error(`Compra no encontrada (ID: ${id})`)

    const purchase = this.purchases[index]

    if (purchase.status === 'RECEIVED' || purchase.status === 'PAID') {
      throw new Error(
        'No es posible anular una compra ya recibida físicamente. Debe realizarse una devolución de inventario.'
      )
    }
    if (purchase.status === 'CANCELLED') {
      throw new Error('Esta compra ya ha sido anulada previamente')
    }

    const nowIso = new Date().toISOString()
    this.purchases[index] = {
      ...purchase,
      status: 'CANCELLED',
      cancellationInfo: {
        cancelledAt: nowIso,
        cancelledByUserId: user.id,
        cancelledByUserName: user.name,
        reason,
      },
      updatedAt: nowIso,
    }

    // Auditoría
    const auditLog = {
      id: `aud-${Date.now()}`,
      action: 'PURCHASE_CANCELLED',
      locationId: purchase.destinationLocationId,
      locationName: purchase.destinationLocationName,
      userId: user.id,
      userName: user.name,
      timestamp: 'Justo ahora',
      changes: {
        purchaseNumber: purchase.purchaseNumber,
        reason,
        status: 'CANCELLED',
      },
    }
    ;(db.auditLogs as unknown as any[]).unshift(auditLog)

    return JSON.parse(JSON.stringify(this.purchases[index]))
  }

  /**
   * Estadísticas consolidadas exclusivas del módulo Compras
   */
  async getStats(): Promise<PurchaseStats> {
    const active = this.purchases.filter((p) => p.status !== 'CANCELLED')
    const today = new Date()

    let totalPurchasedPeriod = 0
    let pendingReceptionCount = 0
    let creditPurchasesCount = 0
    let cashPurchasesCount = 0
    let pendingPaymentInvoicesCount = 0
    let overdueInvoicesCount = 0
    let receivedProductsUnits = 0
    let totalPendingBalance = 0

    for (const p of active) {
      totalPurchasedPeriod += p.total

      if (p.status === 'PENDING_RECEPTION' || p.status === 'DRAFT') {
        pendingReceptionCount++
      }

      if (p.paymentType === 'CREDITO') {
        creditPurchasesCount++
      } else {
        cashPurchasesCount++
      }

      if (p.pendingBalance > 0 && p.status !== 'DRAFT') {
        pendingPaymentInvoicesCount++
        totalPendingBalance += p.pendingBalance

        if (p.dueDate && new Date(p.dueDate) < today) {
          overdueInvoicesCount++
        }
      }

      for (const item of p.items) {
        receivedProductsUnits += item.receivedQuantity || 0
      }
    }

    return {
      totalPurchasedPeriod,
      pendingReceptionCount,
      creditPurchasesCount,
      cashPurchasesCount,
      pendingPaymentInvoicesCount,
      overdueInvoicesCount,
      receivedProductsUnits,
      totalPendingBalance,
      isCostRedacted: false,
    }
  }

  async resetMocks(): Promise<void> {
    this.purchases = [...(db.purchases as unknown as Purchase[])]
  }
}

export const purchaseRepository = new PurchaseRepository()
