import {
  Purchase,
  PurchaseFilterParams,
  PaginatedPurchasesResponse,
  PurchaseStats,
  PurchaseReceipt,
  CreatePurchaseInput,
  UpdatePurchaseInput,
  ReceivePurchaseInput,
  RegisterPaymentInput,
  UserPermissionContext,
} from '../types'
import { purchaseRepository, PurchaseRepository } from '../repositories/purchase.repository'
import { SupabaseClient } from '@supabase/supabase-js'
import { supplierService, SupplierService } from './supplier.service'
import { locationService, LocationService } from './location.service'
import {
  createPurchaseSchema,
  updatePurchaseSchema,
  registerPaymentSchema,
  cancelPurchaseSchema,
  receivePurchaseSchema,
} from '../schemas/purchase.schema'

export class PurchaseService {
  private repository: PurchaseRepository
  private supplierService: SupplierService
  private locationService: LocationService

  constructor(
    repository: PurchaseRepository = purchaseRepository,
    supplierSvc: SupplierService = supplierService,
    locationSvc: LocationService = locationService
  ) {
    this.repository = repository
    this.supplierService = supplierSvc
    this.locationService = locationSvc
  }

  withRepository(repository: PurchaseRepository): PurchaseService {
    return new PurchaseService(repository, this.supplierService, this.locationService)
  }

  withClient(client: SupabaseClient): PurchaseService {
    return new PurchaseService(
      new PurchaseRepository(client),
      new SupplierService(client),
      new LocationService(client)
    )
  }
  private hasPermission(userContext?: UserPermissionContext, ...requiredPermissions: string[]): boolean {
    if (!userContext) return true // Default fallback en contexto local/test
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
    const response = await this.repository.findAll(params)

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

    const purchase = await this.repository.findById(id)
    if (!purchase) return null

    const canReadCost = this.hasPermission(userContext, 'cost.read')
    return this.sanitizePurchaseForUser(purchase, canReadCost)
  }

  /**
   * Crea una nueva orden de compra en el sistema.
   */
  async create(input: CreatePurchaseInput, userContext?: UserPermissionContext): Promise<Purchase> {
    if (!this.hasPermission(userContext, 'purchases.create', 'purchase.create')) {
      throw new Error('No tienes permisos para crear compras (purchases.create requerido)')
    }

    // 1. Validar esquema con Zod
    createPurchaseSchema.parse(input)

    // 2. Verificar existencia del proveedor
    const supplier = await this.supplierService.getById(input.supplierId)
    if (!supplier) {
      throw new Error(`El proveedor seleccionado no existe o no está activo (ID: ${input.supplierId})`)
    }

    // 3. Verificar existencia de la bodega de destino
    const location = await this.locationService.getById(input.destinationLocationId)
    if (!location) {
      throw new Error(`La bodega de destino no existe o no está activa (ID: ${input.destinationLocationId})`)
    }

    // 4. Validar líneas y cantidades
    if (!input.items || input.items.length === 0) {
      throw new Error('Debe agregar al menos un producto a la compra')
    }

    for (const it of input.items) {
      if (it.quantity <= 0) {
        throw new Error(`La cantidad debe ser mayor a 0 para el producto ${it.productName || it.productId}`)
      }
      if (it.unitCost < 0) {
        throw new Error(`El costo unitario no puede ser negativo para el producto ${it.productName || it.productId}`)
      }
    }

    return this.repository.create(input)
  }

  async createPurchase(input: CreatePurchaseInput, userContext?: UserPermissionContext): Promise<Purchase> {
    return this.create(input, userContext)
  }

  /**
   * Actualiza una orden de compra en estado BORRADOR.
   */
  async updatePurchase(
    purchaseId: string,
    input: UpdatePurchaseInput,
    userContext?: UserPermissionContext
  ): Promise<Purchase> {
    if (!this.hasPermission(userContext, 'purchases.create', 'purchase.create')) {
      throw new Error('No tienes permisos para modificar compras (purchases.create requerido)')
    }

    updatePurchaseSchema.parse(input)

    const existing = await this.repository.findById(purchaseId)
    if (!existing) {
      throw new Error(`Orden de compra no encontrada (ID: ${purchaseId})`)
    }

    if (existing.status !== 'BORRADOR' && existing.status !== 'DRAFT') {
      throw new Error(`Solo las órdenes de compra en estado borrador pueden ser editadas (Estado actual: ${existing.status})`)
    }

    const supplier = await this.supplierService.getById(input.supplierId)
    if (!supplier) {
      throw new Error(`El proveedor seleccionado no existe o no está activo (ID: ${input.supplierId})`)
    }

    const location = await this.locationService.getById(input.destinationLocationId)
    if (!location) {
      throw new Error(`La bodega de destino no existe o no está activa (ID: ${input.destinationLocationId})`)
    }

    if (!input.items || input.items.length === 0) {
      throw new Error('Debe agregar al menos un producto a la orden de compra')
    }

    for (const it of input.items) {
      if (it.quantity <= 0) {
        throw new Error(`La cantidad debe ser mayor a 0 para el producto ${it.productName || it.productId}`)
      }
      if (it.unitCost < 0) {
        throw new Error(`El costo unitario no puede ser negativo para el producto ${it.productName || it.productId}`)
      }
    }

    return this.repository.update(purchaseId, input)
  }

  /**
   * Confirma formalmente una orden de compra en estado BORRADOR.
   */
  async confirmOrder(purchaseId: string, userContext?: UserPermissionContext): Promise<Purchase> {
    if (!this.hasPermission(userContext, 'purchases.create', 'purchase.create')) {
      throw new Error('No tienes permisos para confirmar órdenes de compra (purchases.create requerido)')
    }

    return this.repository.confirm(purchaseId)
  }

  /**
   * Anula una orden de compra antes de ser recibida.
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

    return this.repository.cancel(id, reason)
  }

  /**
   * Consulta las actas de recepción física de mercancía.
   */
  async getReceipts(purchaseId?: string, userContext?: UserPermissionContext): Promise<PurchaseReceipt[]> {
    if (!this.hasPermission(userContext, 'purchases.read', 'purchase.read')) {
      throw new Error('No tienes permisos para consultar recepciones (purchases.read requerido)')
    }

    return this.repository.getReceipts(purchaseId)
  }

  /**
   * Recibe físicamente una compra (reservado para Fase 5.2).
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

    return this.repository.receive(payload.purchaseId, payload)
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

    return this.repository.registerPayment(input)
  }

  /**
   * Obtiene estadísticas del módulo compras con control de acceso a costos.
   */
  async getPurchaseStats(userContext?: UserPermissionContext): Promise<PurchaseStats> {
    if (!this.hasPermission(userContext, 'purchases.read', 'purchase.read')) {
      throw new Error('No tienes permisos para ver estadísticas de compras')
    }

    const canReadCost = this.hasPermission(userContext, 'cost.read')
    const rawStats = await this.repository.getPurchaseStats(userContext)

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
    return this.repository.exportToCsv(items, isCostRedacted)
  }
}

export const purchaseService = new PurchaseService()
