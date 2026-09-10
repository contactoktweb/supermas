import {
  Supplier,
  SupplierFilterParams,
  PaginatedSuppliersResponse,
  SupplierStats,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierProductSummary,
  SupplierInvoiceSummary,
  SupplierPaymentSummary,
  SupplierWarehouseRelation,
  SupplierDocumentItem,
  UserPermissionContext,
} from '../types'
import { supplierRepository } from '../repositories/supplier.repository'
import { createSupplierSchema, updateSupplierSchema } from '../schemas/supplier.schema'
import { purchaseService } from '@/features/purchases/services/purchase.service'

export class SupplierService {
  private hasPermission(userContext?: UserPermissionContext, requiredPermission?: string): boolean {
    if (!userContext) return true // Default fallback
    if (userContext.userRole === 'SUPERADMIN' || userContext.userRole === 'ADMIN' || userContext.userRole === 'ADMINISTRADOR') return true
    if (!requiredPermission) return true
    return Array.isArray(userContext.permissions) && userContext.permissions.includes(requiredPermission)
  }

  private sanitizeSupplierForUser(supplier: Supplier, canReadCost: boolean): Supplier {
    if (canReadCost) return supplier

    return {
      ...supplier,
      creditLimit: 0,
      totalPurchased: 0,
      currentBalance: 0,
    }
  }

  /**
   * Consulta paginada y filtrada de proveedores con control RBAC.
   */
  async list(
    params: SupplierFilterParams,
    userContext?: UserPermissionContext
  ): Promise<PaginatedSuppliersResponse> {
    if (!this.hasPermission(userContext, 'supplier.read')) {
      throw new Error('No tienes permisos suficientes para consultar proveedores (supplier.read requerido)')
    }

    const canReadCost = this.hasPermission(userContext, 'cost.read')
    const response = await supplierRepository.findAll(params)

    return {
      items: response.items.map((s) => this.sanitizeSupplierForUser(s, canReadCost)),
      total: response.total,
      page: response.page,
      pageSize: response.pageSize,
      totalPages: response.totalPages,
      isCostRedacted: !canReadCost,
    }
  }

  /**
   * Obtiene la ficha de un proveedor por ID.
   */
  async getById(id: string, userContext?: UserPermissionContext): Promise<Supplier | null> {
    if (!this.hasPermission(userContext, 'supplier.read')) {
      throw new Error('No tienes permisos para consultar este proveedor')
    }

    const supplier = await supplierRepository.findById(id)
    if (!supplier) return null

    const canReadCost = this.hasPermission(userContext, 'cost.read')
    return this.sanitizeSupplierForUser(supplier, canReadCost)
  }

  /**
   * Registra un nuevo proveedor en el sistema previa validación de unicidad de documento.
   */
  async create(input: CreateSupplierInput, userContext?: UserPermissionContext): Promise<Supplier> {
    if (!this.hasPermission(userContext, 'supplier.create')) {
      throw new Error('No tienes permisos para crear proveedores (supplier.create requerido)')
    }

    // 1. Validar esquema Zod
    createSupplierSchema.parse(input)

    // 2. Validar que el número de documento / NIT sea único
    const existing = await supplierRepository.findByDocument(input.documentNumber)
    if (existing) {
      throw new Error(
        `Ya existe un proveedor registrado con el documento/NIT "${input.documentNumber}" (${existing.businessName}).`
      )
    }

    const nowIso = new Date().toISOString()
    const newId = `sup-${Date.now().toString().slice(-6)}`

    const newSupplier: Supplier = {
      id: newId,
      supplierId: newId,
      documentType: input.documentType,
      documentNumber: input.documentNumber.trim(),
      nit: input.documentNumber.trim(),
      businessName: input.businessName.trim(),
      commercialName: input.commercialName?.trim() || undefined,
      supplierName: input.businessName.trim(),
      contactName: input.contactName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      address: input.address.trim(),
      city: input.city.trim(),
      department: input.department.trim(),
      country: input.country || 'Colombia',
      status: input.status || 'ACTIVE',
      creditDays: input.creditDays || 0,
      creditLimit: input.creditLimit || 0,
      notes: input.notes?.trim() || undefined,

      deliveriesCount: 0,
      totalPurchased: 0,
      currentBalance: 0,
      pendingInvoicesCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    return supplierRepository.create(newSupplier, {
      id: userContext?.userId || 'usr-001',
      name: userContext?.userName || 'Mauricio Andrade',
    })
  }

  /**
   * Actualiza los datos de un proveedor.
   */
  async update(
    idOrInput: string | UpdateSupplierInput,
    dataOrContext?: Partial<CreateSupplierInput> | UserPermissionContext,
    optionalContext?: UserPermissionContext
  ): Promise<Supplier> {
    let input: UpdateSupplierInput
    let userContext: UserPermissionContext | undefined

    if (typeof idOrInput === 'string') {
      input = { id: idOrInput, ...(dataOrContext as Partial<CreateSupplierInput>) }
      userContext = optionalContext
    } else {
      input = idOrInput
      userContext = dataOrContext as UserPermissionContext | undefined
    }

    if (!this.hasPermission(userContext, 'supplier.update')) {
      throw new Error('No tienes permisos para editar proveedores (supplier.update requerido)')
    }

    updateSupplierSchema.parse(input)

    // Comprobar unicidad de documento si fue modificado
    if (input.documentNumber) {
      const existing = await supplierRepository.findByDocument(input.documentNumber, input.id)
      if (existing) {
        throw new Error(
          `El documento/NIT "${input.documentNumber}" ya pertenece a otro proveedor registrado (${existing.businessName}).`
        )
      }
    }

    return supplierRepository.update(input.id, input, {
      id: userContext?.userId || 'usr-001',
      name: userContext?.userName || 'Mauricio Andrade',
    })
  }

  /**
   * Desactiva un proveedor validando que no tenga obligaciones pendientes.
   */
  async deactivate(
    id: string,
    reasonOrContext?: string | UserPermissionContext,
    optionalContext?: UserPermissionContext
  ): Promise<Supplier> {
    const userContext = typeof reasonOrContext === 'string' ? optionalContext : reasonOrContext

    if (!this.hasPermission(userContext, 'supplier.deactivate')) {
      throw new Error('No tienes permisos para desactivar proveedores (supplier.deactivate requerido)')
    }

    return supplierRepository.deactivate(id, {
      id: userContext?.userId || 'usr-001',
      name: userContext?.userName || 'Mauricio Andrade',
    })
  }

  /**
   * Registra un abono o pago a factura de proveedor.
   */
  async registerPayment(
    supplierIdOrInput: string | { purchaseId: string; amount: number; paymentMethod: string; reference?: string; notes?: string },
    paymentInputOrContext?: { purchaseId: string; amount: number; paymentMethod: string; reference?: string; notes?: string } | UserPermissionContext,
    optionalContext?: UserPermissionContext
  ) {
    let input: { purchaseId: string; amount: number; paymentMethod: string; reference?: string; notes?: string }
    let userContext: UserPermissionContext | undefined

    if (typeof supplierIdOrInput === 'string') {
      input = paymentInputOrContext as any
      userContext = optionalContext
    } else {
      input = supplierIdOrInput
      userContext = paymentInputOrContext as UserPermissionContext | undefined
    }

    if (!this.hasPermission(userContext, 'supplier.payment') && !this.hasPermission(userContext, 'purchase.payment')) {
      throw new Error('No tienes permisos para registrar pagos a proveedores (supplier.payment requerido)')
    }

    const effectiveContext: UserPermissionContext | undefined = userContext
      ? {
          ...userContext,
          permissions: userContext.permissions.includes('supplier.payment')
            ? Array.from(new Set([...userContext.permissions, 'purchase.payment']))
            : userContext.permissions,
        }
      : undefined

    return purchaseService.registerPayment(input as any, effectiveContext)
  }

  /**
   * Reactiva un proveedor previamente desactivado.
   */
  async activate(id: string, userContext?: UserPermissionContext): Promise<Supplier> {
    if (!this.hasPermission(userContext, 'supplier.update')) {
      throw new Error('No tienes permisos para activar proveedores (supplier.update requerido)')
    }

    return supplierRepository.activate(id, {
      id: userContext?.userId || 'usr-001',
      name: userContext?.userName || 'Mauricio Andrade',
    })
  }

  /**
   * Consulta productos suministrados con protección de costos.
   */
  async getSupplierProducts(
    id: string,
    userContext?: UserPermissionContext
  ): Promise<SupplierProductSummary[]> {
    const products = await supplierRepository.getSupplierProducts(id)
    const canReadCost = this.hasPermission(userContext, 'cost.read')

    if (canReadCost) return products

    return products.map((p) => ({
      ...p,
      lastUnitCost: 0,
      totalValueSupplied: 0,
    }))
  }

  /**
   * Alias de getSupplierProducts para compatibilidad.
   */
  async getSuppliedProducts(
    id: string,
    userContext?: UserPermissionContext
  ): Promise<SupplierProductSummary[]> {
    return this.getSupplierProducts(id, userContext)
  }

  /**
   * Consulta facturas de compra del proveedor con protección de costos.
   */
  async getSupplierInvoices(
    id: string,
    userContext?: UserPermissionContext
  ): Promise<SupplierInvoiceSummary[]> {
    const invoices = await supplierRepository.getSupplierInvoices(id)
    const canReadCost = this.hasPermission(userContext, 'cost.read')

    if (canReadCost) return invoices

    return invoices.map((inv) => ({
      ...inv,
      total: 0,
      paidAmount: 0,
      pendingBalance: 0,
    }))
  }

  /**
   * Consulta pagos realizados al proveedor.
   */
  async getSupplierPayments(
    id: string,
    userContext?: UserPermissionContext
  ): Promise<SupplierPaymentSummary[]> {
    const payments = await supplierRepository.getSupplierPayments(id)
    const canReadCost = this.hasPermission(userContext, 'cost.read')

    if (canReadCost) return payments

    return payments.map((pay) => ({
      ...pay,
      amount: 0,
    }))
  }

  /**
   * Consulta la relación y volumen operado por bodega.
   */
  async getSupplierWarehouses(
    id: string,
    userContext?: UserPermissionContext
  ): Promise<SupplierWarehouseRelation[]> {
    const warehouses = await supplierRepository.getSupplierWarehouses(id)
    const canReadCost = this.hasPermission(userContext, 'cost.read')

    if (canReadCost) return warehouses

    return warehouses.map((w) => ({
      ...w,
      totalAmount: 0,
    }))
  }

  /**
   * Consulta documentos adjuntos del proveedor.
   */
  async getSupplierDocuments(
    id: string,
    userContext?: UserPermissionContext
  ): Promise<SupplierDocumentItem[]> {
    if (!this.hasPermission(userContext, 'supplier.documents')) {
      return []
    }
    return supplierRepository.getSupplierDocuments(id)
  }

  /**
   * Consulta la bitácora de auditoría del proveedor.
   */
  async getSupplierAuditLogs(id: string, userContext?: UserPermissionContext) {
    return supplierRepository.getSupplierAuditLogs(id)
  }

  /**
   * Consulta las estadísticas globales de proveedores.
   */
  async getSupplierStats(userContext?: UserPermissionContext): Promise<SupplierStats> {
    const stats = await supplierRepository.getSupplierStats()
    const canReadCost = this.hasPermission(userContext, 'cost.read')

    if (!canReadCost) {
      return {
        ...stats,
        totalPendingBalance: 0,
        totalPurchasedPeriod: 0,
        isCostRedacted: true,
      }
    }

    return stats
  }

  /**
   * Exporta proveedores en formato CSV.
   */
  exportToCsv(suppliers: Supplier[], isCostRedacted: boolean = false): string {
    return supplierRepository.exportToCsv(suppliers, isCostRedacted)
  }
}

export const supplierService = new SupplierService()
