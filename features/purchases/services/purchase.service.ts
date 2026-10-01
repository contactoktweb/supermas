import {
  Purchase,
  PurchaseFilterParams,
  PaginatedPurchasesResponse,
  PurchaseStats,
  CreatePurchaseInput,
  ReceivePurchaseInput,
  RegisterPaymentInput,
  UserPermissionContext,
} from '../types'
import { purchaseRepository } from '../repositories/purchase.repository'
import { purchaseCalculationService } from './purchase-calculation.service'
import { supplierService } from './supplier.service'
import { locationService } from './location.service'
import {
  createPurchaseSchema,
  registerPaymentSchema,
  cancelPurchaseSchema,
  receivePurchaseSchema,
} from '../schemas/purchase.schema'

export class PurchaseService {
  private hasPermission(userContext?: UserPermissionContext, ...requiredPermissions: string[]): boolean {
    if (!userContext) return true // Default fallback
    if (
      userContext.userRole === 'SUPERADMIN' ||
      userContext.userRole === 'ADMIN' ||
      userContext.userRole === 'ADMINISTRADOR'
    )
      return true
    if (!requiredPermissions || requiredPermissions.length === 0) return true
    const perms = Array.isArray(userContext.permissions) ? userContext.permissions : []
    return requiredPermissions.some((req) => perms.includes(req))
  }

  private sanitizePurchaseForUser(purchase: Purchase, canReadCost: boolean): Purchase {
    if (canReadCost) return purchase

    return {
      ...purchase,
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
      paidAmount: 0,
      pendingBalance: 0,
      totalCost: 0,
      items: purchase.items.map((i) => ({
        ...i,
        unitCost: 0,
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        total: 0,
      })),
      payments: purchase.payments.map((p) => ({
        ...p,
        amount: 0,
      })),
    }
  }

  /**
   * Obtiene compras paginadas y filtradas con protección de costos RBAC.
   */
  async list(
    params: PurchaseFilterParams,
    userContext?: UserPermissionContext
  ): Promise<PaginatedPurchasesResponse> {
    if (!this.hasPermission(userContext, 'purchases.read', 'purchase.read')) {
      throw new Error('No tienes permisos suficientes para consultar compras (purchases.read requerido)')
    }

    const canReadCost = this.hasPermission(userContext, 'cost.read')
    const response = await purchaseRepository.findAll(params)

    const items = response.data.map((p) => this.sanitizePurchaseForUser(p, canReadCost))

    return {
      items,
      total: response.total,
      page: params.page || 1,
      pageSize: params.pageSize || 10,
      totalPages: Math.ceil(response.total / (params.pageSize || 10)) || 1,
      isCostRedacted: !canReadCost,
    }
  }

  /**
   * Obtiene una compra por su ID con verificación de permisos y sanitización de costos.
   */
  async getById(id: string, userContext?: UserPermissionContext): Promise<Purchase | null> {
    if (!this.hasPermission(userContext, 'purchases.read', 'purchase.read')) {
      throw new Error('No tienes permisos para ver el detalle de compras')
    }

    const purchase = await purchaseRepository.findById(id)
    if (!purchase) return null

    const canReadCost = this.hasPermission(userContext, 'cost.read')
    return this.sanitizePurchaseForUser(purchase, canReadCost)
  }

  /**
   * Crea una nueva compra en el sistema.
   */
  async create(input: CreatePurchaseInput, userContext?: UserPermissionContext): Promise<Purchase> {
    if (!this.hasPermission(userContext, 'purchases.create', 'purchase.create')) {
      throw new Error('No tienes permisos para crear compras (purchases.create requerido)')
    }

    // 1. Validar esquema con Zod
    createPurchaseSchema.parse(input)

    // 2. Verificar existencia del proveedor
    const supplier = await supplierService.getById(input.supplierId)
    if (!supplier) {
      throw new Error(`El proveedor seleccionado no existe (ID: ${input.supplierId})`)
    }

    // 3. Verificar existencia de la bodega de destino
    const location = await locationService.getById(input.destinationLocationId)
    if (!location) {
      throw new Error(`La bodega de destino no existe (ID: ${input.destinationLocationId})`)
    }

    // 4. Calcular líneas e impuestos con el motor matemático
    const calculatedItems = input.items.map((itemInput) =>
      purchaseCalculationService.calculateLineItem(itemInput)
    )
    const totals = purchaseCalculationService.calculateTotals(calculatedItems)

    const nowIso = new Date().toISOString()
    const autoCode = `COM-${String(Date.now()).slice(-6)}`
    const status = input.saveAsDraft ? 'DRAFT' : 'PENDING_RECEPTION'

    const newPurchase: Purchase = {
      id: '',
      purchaseNumber: autoCode,
      supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
      invoiceNumber: autoCode,
      locationId: location.id,
      totalCost: totals.total,
      paymentTerms: input.paymentType,
      itemsCount: calculatedItems.reduce((acc, i) => acc + i.quantity, 0),

      date: input.date || nowIso,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierNit: supplier.nit,
      supplierPhone: supplier.phone,
      supplierEmail: supplier.email,

      destinationLocationId: location.id,
      destinationLocationName: location.name,
      destinationLocationCode: location.code,

      paymentType: input.paymentType,
      dueDate: input.paymentType === 'CREDITO' ? input.dueDate : undefined,
      status,

      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,

      paidAmount: input.paymentType === 'CONTADO' ? totals.total : 0,
      pendingBalance: input.paymentType === 'CONTADO' ? 0 : totals.total,

      items: calculatedItems,
      payments: [],
      attachments: input.attachment
        ? [
            {
              id: `att-${Date.now()}`,
              fileName: input.attachment.fileName,
              fileType: input.attachment.fileType,
              fileSize: input.attachment.fileSize,
              url: input.attachment.url,
              uploadedAt: nowIso,
              uploadedBy: userContext?.userName || 'Administrador',
            },
          ]
        : [],

      createdByUserId: userContext?.userId || 'usr-001',
      createdByUserName: userContext?.userName || 'Administrador',
      notes: input.notes?.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    return purchaseRepository.create(newPurchase)
  }

  async createPurchase(input: CreatePurchaseInput, userContext?: UserPermissionContext): Promise<Purchase> {
    return this.create(input, userContext)
  }

  /**
   * Recibe físicamente una compra e ingresa la mercancía al inventario y Kardex.
   */
  async receivePurchase(
    inputOrId: ReceivePurchaseInput | string,
    notesOrContext?: string | UserPermissionContext,
    userContext?: UserPermissionContext
  ): Promise<Purchase> {
    let payload: ReceivePurchaseInput
    let context = userContext

    if (typeof inputOrId === 'string') {
      payload = {
        purchaseId: inputOrId,
        notes: typeof notesOrContext === 'string' ? notesOrContext : undefined,
      }
      if (typeof notesOrContext === 'object' && notesOrContext !== null) {
        context = notesOrContext as UserPermissionContext
      }
    } else {
      payload = inputOrId
      if (typeof notesOrContext === 'object' && notesOrContext !== null) {
        context = notesOrContext as UserPermissionContext
      }
    }

    if (!this.hasPermission(context, 'purchases.create', 'purchase.receive', 'purchase.create')) {
      throw new Error('No tienes permisos para recibir compras (purchases.create requerido)')
    }

    receivePurchaseSchema.parse(payload)

    return purchaseRepository.receive(payload.purchaseId, payload, {
      id: context?.userId || 'usr-001',
      name: context?.userName || 'Administrador',
    })
  }

  /**
   * Registra un abono o pago a proveedor.
   */
  async registerPayment(
    input: RegisterPaymentInput,
    userContext?: UserPermissionContext
  ): Promise<Purchase> {
    if (!this.hasPermission(userContext, 'treasury.create', 'purchases.create', 'purchase.payment')) {
      throw new Error('No tienes permisos para registrar pagos (purchases.create / treasury.create requerido)')
    }

    registerPaymentSchema.parse(input)

    return purchaseRepository.registerPayment(input, {
      id: userContext?.userId || 'usr-001',
      name: userContext?.userName || 'Administrador',
    })
  }

  /**
   * Anula una compra antes de ser recibida.
   */
  async cancelPurchase(
    id: string,
    reason: string,
    userContext?: UserPermissionContext
  ): Promise<Purchase> {
    if (!this.hasPermission(userContext, 'purchases.create', 'purchase.cancel')) {
      throw new Error('No tienes permisos para anular compras (purchases.create requerido)')
    }

    cancelPurchaseSchema.parse({ purchaseId: id, reason })

    return purchaseRepository.cancel(id, reason, {
      id: userContext?.userId || 'usr-001',
      name: userContext?.userName || 'Administrador',
    })
  }

  /**
   * Obtiene estadísticas del módulo compras con control de acceso a costos.
   */
  async getPurchaseStats(userContext?: UserPermissionContext): Promise<PurchaseStats> {
    if (!this.hasPermission(userContext, 'purchases.read', 'purchase.read')) {
      throw new Error('No tienes permisos para ver estadísticas de compras')
    }

    const canReadCost = this.hasPermission(userContext, 'cost.read')
    const rawStats = await purchaseRepository.getPurchaseStats(userContext)

    if (!canReadCost) {
      return {
        ...rawStats,
        totalPurchasedPeriod: 0,
        totalPendingBalance: 0,
        isCostRedacted: true,
      }
    }

    return rawStats
  }

  /**
   * Exporta las compras en formato CSV con ofuscación según permisos.
   */
  async exportPurchasesCsv(
    params: PurchaseFilterParams,
    userContext?: UserPermissionContext
  ): Promise<string> {
    const { items, isCostRedacted } = await this.list({ ...params, pageSize: 1000 }, userContext)
    return this.exportToCsv(items, isCostRedacted)
  }

  exportToCsv(items: Purchase[], isCostRedacted: boolean = false): string {
    return purchaseRepository.exportToCsv(items, isCostRedacted)
  }
}

export const purchaseService = new PurchaseService()
