import { customerRepository, CustomerRepository } from '../repositories/customer.repository'
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

const DEFAULT_USER: CustomerUserContext = {
  userId: 'usr-admin-01',
  userName: 'Administrador Maestro',
  permissions: [
    'customer.read',
    'customer.create',
    'customer.update',
    'customer.deactivate',
    'customer.documents',
    'customer.export',
    'sales.read',
  ],
}

export class CustomerService {
  constructor(private repo: CustomerRepository = customerRepository) {}

  /**
   * Helper para verificar permisos RBAC
   */
  private checkPermission(context: CustomerUserContext, permission: string): void {
    if (!context.permissions.includes(permission) && !context.permissions.includes('*')) {
      throw new Error(
        `Acceso denegado: El usuario "${context.userName}" no cuenta con el permiso requerido [${permission}].`
      )
    }
  }

  /**
   * Lista clientes con filtros, paginación y búsqueda
   */
  async list(
    params: CustomerFilterParams = {},
    user: CustomerUserContext = DEFAULT_USER
  ): Promise<{
    items: Customer[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    this.checkPermission(user, 'customer.read')
    const validated = customerFilterSchema.parse(params)
    return this.repo.findFiltered(validated as CustomerFilterParams)
  }

  /**
   * Obtiene todos los clientes sin paginación
   */
  async getAll(user: CustomerUserContext = DEFAULT_USER): Promise<Customer[]> {
    this.checkPermission(user, 'customer.read')
    return this.repo.findAll()
  }

  /**
   * Obtiene el detalle completo del cliente por ID
   */
  async getById(id: string, user: CustomerUserContext = DEFAULT_USER): Promise<CustomerDetail> {
    this.checkPermission(user, 'customer.read')
    const detail = await this.repo.getDetail(id)
    if (!detail) {
      throw new Error(`El cliente con ID "${id}" no existe en el sistema.`)
    }

    // Si el usuario no tiene permiso sales.read, enmascarar información de costos o margen
    if (!user.permissions.includes('sales.read') && !user.permissions.includes('*')) {
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
  async getCustomerStats(user: CustomerUserContext = DEFAULT_USER): Promise<CustomerStats> {
    this.checkPermission(user, 'customer.read')
    return this.repo.getStats()
  }

  /**
   * Crea un nuevo cliente con validaciones de negocio y auditoría
   */
  async create(
    dto: CreateCustomerDTO,
    user: CustomerUserContext = DEFAULT_USER
  ): Promise<Customer> {
    this.checkPermission(user, 'customer.create')

    // 1. Validación de esquema con Zod
    const validated = createCustomerSchema.parse(dto)

    // 2. Validación de duplicidad por número de documento
    const existing = await this.repo.findByDocument(validated.documentNumber)
    if (existing) {
      throw new Error(
        `Ya existe un cliente registrado con el documento/NIT "${validated.documentNumber}" (${existing.displayName}).`
      )
    }

    // 3. Formateo de nombres y razón social
    const displayName =
      validated.customerType === 'COMPANY'
        ? validated.businessName || 'Empresa Sin Nombre'
        : `${validated.firstName || ''} ${validated.lastName || ''}`.trim() || 'Cliente Sin Nombre'

    const contactPerson =
      validated.contactPerson?.trim() ||
      (validated.customerType === 'NATURAL'
        ? displayName
        : validated.firstName
        ? `${validated.firstName} ${validated.lastName || ''}`.trim()
        : 'Representante Legal')

    const newCustomer: Customer = {
      id: `cust-${Date.now().toString().slice(-6)}`,
      customerType: validated.customerType,
      documentType: validated.documentType,
      documentNumber: validated.documentNumber,
      firstName: validated.firstName,
      lastName: validated.lastName,
      businessName: validated.businessName,
      commercialName: validated.commercialName,
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
      totalPurchased: 0,
      purchasesCount: 0,
      preferredLocationId: validated.preferredLocationId || 'loc-001',
      status: 'ACTIVE',
      notes: validated.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const created = await this.repo.create(newCustomer)

    // 4. Registro de auditoría
    await this.repo.logAudit({
      user: user.userName,
      action: 'CREACIÓN_CLIENTE',
      details: `Cliente "${created.displayName}" (${created.documentType} ${created.documentNumber}) creado exitosamente. Tipo: ${created.customerType}. Lista: ${created.priceList}.`,
      entityId: created.id,
      newValues: { ...created },
    })

    return created
  }

  /**
   * Actualiza los datos de un cliente existente con auditoría de cambios
   */
  async update(
    id: string,
    dto: UpdateCustomerDTO,
    user: CustomerUserContext = DEFAULT_USER
  ): Promise<Customer> {
    this.checkPermission(user, 'customer.update')

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

    // Registro de auditoría
    await this.repo.logAudit({
      user: user.userName,
      action: 'EDICIÓN_CLIENTE',
      details: `Información de cliente "${updated.displayName}" actualizada.`,
      entityId: id,
      oldValues: { ...existing },
      newValues: { ...updated },
    })

    return updated
  }

  /**
   * Desactivación segura (soft delete) comprobando saldos y compromisos abiertos
   */
  async deactivate(
    id: string,
    reason: string = 'Desactivación solicitada por administración',
    user: CustomerUserContext = DEFAULT_USER
  ): Promise<Customer> {
    this.checkPermission(user, 'customer.deactivate')

    const customer = await this.repo.findById(id)
    if (!customer) {
      throw new Error(`El cliente con ID "${id}" no existe.`)
    }

    if (customer.documentNumber === '222222222222') {
      throw new Error('El cliente genérico institucional "Consumidor Final" no puede ser desactivado.')
    }

    // Comprobación de seguridad: verificar que no tenga saldo pendiente
    if (customer.currentBalance > 0) {
      const formatted = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(customer.currentBalance)
      throw new Error(
        `No es posible desactivar al cliente "${customer.displayName}" porque posee un saldo pendiente de ${formatted} en cartera. Debe liquidar las cuentas por cobrar primero.`
      )
    }

    const updated = await this.repo.update(id, {
      status: 'INACTIVE',
      notes: customer.notes
        ? `${customer.notes} | Motivo desactivación: ${reason}`
        : `Motivo desactivación: ${reason}`,
    })

    if (!updated) {
      throw new Error(`Error al desactivar el cliente "${id}".`)
    }

    // Registro en auditoría
    await this.repo.logAudit({
      user: user.userName,
      action: 'DESACTIVACIÓN_CLIENTE',
      details: `Cliente "${updated.displayName}" desactivado. Motivo: ${reason}`,
      entityId: id,
      oldValues: { status: customer.status },
      newValues: { status: 'INACTIVE', reason },
    })

    return updated
  }

  /**
   * Reactiva un cliente inactivo
   */
  async reactivate(id: string, user: CustomerUserContext = DEFAULT_USER): Promise<Customer> {
    this.checkPermission(user, 'customer.update')

    const customer = await this.repo.findById(id)
    if (!customer) {
      throw new Error(`El cliente con ID "${id}" no existe.`)
    }

    const updated = await this.repo.update(id, { status: 'ACTIVE' })
    if (!updated) {
      throw new Error(`Error al reactivar el cliente "${id}".`)
    }

    await this.repo.logAudit({
      user: user.userName,
      action: 'REACTIVACIÓN_CLIENTE',
      details: `Cliente "${updated.displayName}" reactivado satisfactoriamente.`,
      entityId: id,
      oldValues: { status: customer.status },
      newValues: { status: 'ACTIVE' },
    })

    return updated
  }

  /**
   * Registra un pago / abono a cartera de un cliente
   */
  async addPayment(
    dto: CustomerPaymentDTO,
    user: CustomerUserContext = DEFAULT_USER
  ): Promise<CustomerPaymentSummary> {
    this.checkPermission(user, 'customer.update')
    const validated = customerPaymentSchema.parse(dto)

    const customer = await this.repo.findById(validated.customerId)
    if (!customer) {
      throw new Error(`El cliente con ID "${validated.customerId}" no existe.`)
    }

    const receipt: CustomerPaymentSummary = {
      id: `pay-${Date.now().toString().slice(-6)}`,
      receiptNumber: `RC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: validated.customerId,
      invoiceId: validated.invoiceId,
      date: new Date().toISOString(),
      amount: validated.amount,
      paymentMethod: validated.paymentMethod,
      reference: validated.reference,
      user: user.userName,
      notes: validated.notes,
    }

    const created = await this.repo.addPayment(receipt)

    // Auditoría
    const formattedAmount = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(validated.amount)

    await this.repo.logAudit({
      user: user.userName,
      action: 'ABONO_CARTERA_CLIENTE',
      details: `Recibo de pago ${created.receiptNumber} registrado por ${formattedAmount} para el cliente "${customer.displayName}". Ref: ${created.reference}.`,
      entityId: validated.customerId,
      newValues: { ...created },
    })

    return created
  }

  /**
   * Adjunta un soporte o documento al expediente del cliente (Supabase Storage)
   */
  async addDocument(
    dto: CustomerDocumentDTO,
    user: CustomerUserContext = DEFAULT_USER
  ): Promise<CustomerDocumentSummary> {
    this.checkPermission(user, 'customer.documents')
    const validated = customerDocumentSchema.parse(dto)

    const customer = await this.repo.findById(validated.customerId)
    if (!customer) {
      throw new Error(`El cliente con ID "${validated.customerId}" no existe.`)
    }

    const docSummary: CustomerDocumentSummary = {
      id: `doc-${Date.now().toString().slice(-6)}`,
      customerId: validated.customerId,
      fileName: validated.fileName,
      fileUrl: `supabase-storage://customers/${validated.customerId}/${validated.fileName}`,
      fileType: validated.fileType,
      fileSize: validated.fileSize,
      category: validated.category,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.userName,
      notes: validated.notes,
    }

    const created = await this.repo.addDocument(docSummary)

    await this.repo.logAudit({
      user: user.userName,
      action: 'DOCUMENTO_CLIENTE_ADJUNTO',
      details: `Documento "${created.fileName}" (${created.category}) adjuntado al expediente de "${customer.displayName}".`,
      entityId: validated.customerId,
      newValues: { ...created },
    })

    return created
  }

  /**
   * Búsqueda optimizada para POS y venta rápida de mostrador
   */
  async searchForPos(
    query: string,
    user: CustomerUserContext = DEFAULT_USER
  ): Promise<Customer[]> {
    this.checkPermission(user, 'customer.read')
    const clean = query.trim().toLowerCase()

    const all = await this.repo.findAll()

    if (!clean) {
      // Retornar cliente genérico y primeros activos
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
