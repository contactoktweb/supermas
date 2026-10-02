/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Clientes (CustomerService)
 * 
 * Reglas de negocio, validaciones Zod y control RBAC fiduciario
 * conectado exclusivamente a PostgreSQL / Supabase.
 */

import { customerRepository, CustomerRepository } from '../repositories/customer.repository'
import { accountsReceivableService } from './accounts-receivable.service'
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerPaymentSchema,
  customerDocumentSchema,
  customerFilterSchema,
} from '../schemas/customer.schema'
import {
  Customer,
  CustomerDetail,
  CustomerFilterParams,
  CustomerStats,
  CreateCustomerDTO,
  UpdateCustomerDTO,
  CustomerPaymentDTO,
  CustomerDocumentDTO,
  CustomerUserContext,
  CustomerPaymentSummary,
  CustomerDocumentSummary,
} from '../types'

export class CustomerService {
  constructor(private repo: CustomerRepository = customerRepository) {}

  /**
   * Helper para verificar permisos RBAC
   */
  private checkPermission(context?: CustomerUserContext, ...requiredPermissions: string[]): void {
    if (!context) return // Acceso autorizado por defecto para operaciones de sistema / backend
    if (!requiredPermissions || requiredPermissions.length === 0) return

    const perms = Array.isArray(context.permissions) ? context.permissions : []
    const hasAny = requiredPermissions.some((req) => perms.includes(req) || perms.includes('*'))

    if (!hasAny) {
      throw new Error(
        `Acceso denegado: El usuario "${context.userName || 'Usuario'}" no cuenta con los permisos requeridos [${requiredPermissions.join(', ')}].`
      )
    }
  }

  /**
   * Lista clientes con filtros, paginación y búsqueda
   */
  async list(
    params: CustomerFilterParams = {},
    user?: CustomerUserContext
  ): Promise<{
    items: Customer[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    this.checkPermission(user, 'customers.read', 'customer.read')
    const validated = customerFilterSchema.parse(params)
    return this.repo.findFiltered(validated as CustomerFilterParams)
  }

  /**
   * Obtiene todos los clientes sin paginación
   */
  async getAll(user?: CustomerUserContext): Promise<Customer[]> {
    this.checkPermission(user, 'customers.read', 'customer.read')
    return this.repo.findAll()
  }

  /**
   * Obtiene el detalle completo del cliente por ID
   */
  async getById(id: string, user?: CustomerUserContext): Promise<CustomerDetail> {
    this.checkPermission(user, 'customers.read', 'customer.read')
    const detail = await this.repo.getDetail(id)
    if (!detail) {
      throw new Error(`El cliente con ID "${id}" no existe en el sistema.`)
    }

    // Si el usuario no tiene permiso sales.read, enmascarar información de costos o margen
    if (user && !user.permissions.includes('sales.read') && !user.permissions.includes('*')) {
      detail.sales = detail.sales.map((s) => ({
        ...s,
        costAmount: undefined,
        profitAmount: undefined,
      }))
    }

    return detail
  }

  /**
   * Obtiene estadísticas de clientes para las tarjetas KPI
   */
  async getCustomerStats(user?: CustomerUserContext): Promise<CustomerStats> {
    this.checkPermission(user, 'customers.read', 'customer.read')
    return this.repo.getStats()
  }

  /**
   * Registra un nuevo cliente validando documento único y datos obligatorios
   */
  async create(dto: CreateCustomerDTO, user?: CustomerUserContext): Promise<Customer> {
    this.checkPermission(user, 'customers.write', 'customer.create')
    const validated = createCustomerSchema.parse(dto)

    // Validar unicidad del documento
    const existing = await this.repo.findByDocument(validated.documentNumber)
    if (existing) {
      throw new Error(
        `Ya existe un cliente registrado con el número de documento "${validated.documentNumber}" (${existing.displayName}).`
      )
    }

    // Construir razón social o nombre para mostrar
    let displayName = ''
    let contactPerson = validated.contactPerson || ''

    if (validated.customerType === 'COMPANY') {
      displayName = validated.businessName || 'Empresa'
    } else {
      const fn = validated.firstName?.trim() || ''
      const ln = validated.lastName?.trim() || ''
      displayName = `${fn} ${ln}`.trim() || 'Persona Natural'
      if (!contactPerson) contactPerson = displayName
    }

    const newCustomer: Partial<Customer> = {
      customerType: validated.customerType,
      documentType: validated.documentType,
      documentNumber: validated.documentNumber,
      verificationDigit: validated.verificationDigit,
      firstName: validated.firstName,
      lastName: validated.lastName,
      businessName: validated.businessName,
      commercialName: validated.commercialName || validated.businessName,
      displayName,
      contactPerson,
      phone: validated.phone,
      mobile: validated.mobile || validated.phone,
      email: validated.email,
      address: validated.address,
      city: validated.city,
      department: validated.department,
      country: validated.country || 'Colombia',
      category: validated.category || 'FREQUENT',
      priceList: validated.priceList || 'DEFAULT',
      creditLimit: validated.creditLimit || 0,
      creditDays: validated.creditDays || 0,
      currentBalance: 0,
      preferredLocationId: validated.preferredLocationId,
      status: 'ACTIVE',
      notes: validated.notes,
    }

    return this.repo.create(newCustomer)
  }

  /**
   * Actualiza los datos de un cliente existente
   */
  async update(
    id: string,
    dto: UpdateCustomerDTO,
    user?: CustomerUserContext
  ): Promise<Customer> {
    this.checkPermission(user, 'customers.write', 'customer.update')

    const existing = await this.repo.findById(id)
    if (!existing) {
      throw new Error(`El cliente con ID "${id}" no existe.`)
    }

    const validated = updateCustomerSchema.parse(dto)

    // Si cambia el documento, verificar que no colisione con otro
    if (
      validated.documentNumber &&
      validated.documentNumber.trim() !== existing.documentNumber.trim()
    ) {
      const duplicate = await this.repo.findByDocument(validated.documentNumber)
      if (duplicate && duplicate.id !== id) {
        throw new Error(
          `No es posible actualizar el documento a "${validated.documentNumber}" porque ya está asignado a "${duplicate.displayName}".`
        )
      }
    }

    // Recalcular displayName si cambian nombres o razón social
    let displayName = existing.displayName
    const customerType = validated.customerType || existing.customerType
    if (customerType === 'COMPANY') {
      if (validated.businessName) displayName = validated.businessName
    } else {
      const fn = validated.firstName !== undefined ? validated.firstName : existing.firstName
      const ln = validated.lastName !== undefined ? validated.lastName : existing.lastName
      if (fn || ln) displayName = `${fn || ''} ${ln || ''}`.trim()
    }

    const updated = await this.repo.update(id, {
      ...validated,
      displayName,
    })

    if (!updated) {
      throw new Error(`Error al actualizar el cliente "${id}".`)
    }

    return updated
  }

  /**
   * Desactiva un cliente en el sistema
   */
  async deactivate(
    id: string,
    _reason?: string,
    user?: CustomerUserContext
  ): Promise<Customer> {
    this.checkPermission(user, 'customers.write', 'customer.deactivate')

    const customer = await this.repo.findById(id)
    if (!customer) {
      throw new Error(`El cliente con ID "${id}" no existe.`)
    }

    await this.repo.deactivate(id)
    const updated = await this.repo.findById(id)
    if (!updated) {
      throw new Error(`Error al desactivar el cliente "${id}".`)
    }
    return updated
  }

  /**
   * Reactiva un cliente inactivo
   */
  async reactivate(id: string, user?: CustomerUserContext): Promise<Customer> {
    this.checkPermission(user, 'customers.write', 'customer.update')

    const customer = await this.repo.findById(id)
    if (!customer) {
      throw new Error(`El cliente con ID "${id}" no existe.`)
    }

    await this.repo.reactivate(id)
    const updated = await this.repo.findById(id)
    if (!updated) {
      throw new Error(`Error al reactivar el cliente "${id}".`)
    }
    return updated
  }

  /**
   * Registra un pago / abono a cartera de un cliente conectado a AccountsReceivableService
   */
  async addPayment(
    dto: CustomerPaymentDTO,
    user?: CustomerUserContext
  ): Promise<CustomerPaymentSummary> {
    this.checkPermission(user, 'customers.write', 'sales.create', 'treasury.create')
    const validated = customerPaymentSchema.parse(dto)

    const customer = await this.repo.findById(validated.customerId)
    if (!customer) {
      throw new Error(`El cliente con ID "${validated.customerId}" no existe.`)
    }

    // Si tiene invoiceId/saleId se abona a esa venta; de lo contrario buscar la venta con saldo más antigua
    let targetSaleId = validated.invoiceId
    if (!targetSaleId) {
      const cxcList = await accountsReceivableService.list({
        customerId: validated.customerId,
        status: 'PENDIENTE',
        pageSize: 1,
      })
      if (cxcList.items.length > 0) {
        targetSaleId = cxcList.items[0].saleId
      }
    }

    if (!targetSaleId) {
      throw new Error(`El cliente "${customer.displayName}" no tiene obligaciones pendientes con saldo en mora para abonar.`)
    }

    const paymentResult = await accountsReceivableService.registerPayment(
      {
        saleId: targetSaleId,
        amount: validated.amount,
        paymentMethod: validated.paymentMethod,
        reference: validated.reference,
        notes: validated.notes,
      },
      {
        id: user?.userId,
        name: user?.userName,
      }
    )

    return {
      id: paymentResult.paymentId,
      receiptNumber: paymentResult.paymentNumber,
      customerId: validated.customerId,
      invoiceId: targetSaleId,
      date: new Date().toISOString(),
      amount: validated.amount,
      paymentMethod: validated.paymentMethod,
      reference: validated.reference,
      user: user?.userName || 'Sistema',
      notes: validated.notes,
    }
  }

  /**
   * Adjunta un soporte o documento al expediente del cliente
   */
  async addDocument(
    dto: CustomerDocumentDTO,
    user?: CustomerUserContext
  ): Promise<CustomerDocumentSummary> {
    this.checkPermission(user, 'customers.write', 'customer.documents')
    const validated = customerDocumentSchema.parse(dto)

    const customer = await this.repo.findById(validated.customerId)
    if (!customer) {
      throw new Error(`El cliente con ID "${validated.customerId}" no existe.`)
    }

    const docSummary: CustomerDocumentSummary = {
      id: `doc-${Date.now().toString().slice(-6)}`,
      customerId: validated.customerId,
      fileName: validated.fileName,
      fileUrl: `/documents/customers/${validated.customerId}/${validated.fileName}`,
      fileType: validated.fileType,
      fileSize: validated.fileSize,
      category: validated.category,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user?.userName || 'Sistema',
      notes: validated.notes,
    }

    return docSummary
  }

  /**
   * Búsqueda optimizada para POS y venta rápida de mostrador
   */
  async searchForPos(
    query: string,
    user?: CustomerUserContext
  ): Promise<Customer[]> {
    this.checkPermission(user, 'customers.read', 'customer.read', 'pos.access')
    const clean = query.trim().toLowerCase()

    const all = await this.repo.findAll()

    if (!clean) {
      return all.filter((c) => c.status === 'ACTIVE').slice(0, 5)
    }

    return all.filter((c) => {
      if (c.status !== 'ACTIVE') return false
      return (
        c.documentNumber.toLowerCase().includes(clean) ||
        c.displayName.toLowerCase().includes(clean) ||
        c.phone.toLowerCase().includes(clean) ||
        c.email.toLowerCase().includes(clean)
      )
    })
  }

  /**
   * Obtiene o crea un cliente para pedidos Web / Ecommerce
   */
  async getOrCreateWebCustomer(data: {
    documentNumber: string
    documentType?: 'CC' | 'NIT'
    fullName: string
    email: string
    phone: string
    address: string
    city: string
    department: string
  }): Promise<Customer> {
    const existing = await this.repo.findByDocument(data.documentNumber)
    if (existing) {
      return existing
    }

    return this.create({
      customerType: data.documentType === 'NIT' ? 'COMPANY' : 'NATURAL',
      documentType: data.documentType || 'CC',
      documentNumber: data.documentNumber,
      firstName: data.fullName,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      department: data.department,
      category: 'FREQUENT',
      priceList: 'DEFAULT',
      notes: 'Cliente registrado automáticamente a través del canal Ecommerce / Tienda Web.',
    })
  }
}

export const customerService = new CustomerService()
