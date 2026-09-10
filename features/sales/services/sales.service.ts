import { salesRepository, SalesRepository } from '../repositories/sales.repository'
import { salesCalculationService } from './sales-calculation.service'
import {
  createSaleSchema,
  cancelSaleSchema,
  createInvoiceFromSaleSchema,
  createRemissionFromSaleSchema,
  saleReturnSchema,
  saleFilterSchema,
} from '../schemas/sales.schema'
import {
  Sale,
  SaleDetail,
  SaleFilterParams,
  SaleStats,
  CreateSaleDTO,
  CancelSaleDTO,
  CreateInvoiceFromSaleDTO,
  CreateRemissionFromSaleDTO,
  SaleReturnDTO,
  SalesUserContext,
  SaleItem,
} from '../types'
import { db, supabaseMock } from '@/lib/supabase'

const DEFAULT_USER: SalesUserContext = {
  userId: 'usr-admin-01',
  userName: 'Admin Mauricio',
  userRole: 'Administrador Maestro',
  maxAllowedDiscountPercent: 25,
  permissions: [
    'sales.read',
    'sales.create',
    'sales.update',
    'sales.cancel',
    'sales.discount',
    'sales.return',
    'sales.export',
  ],
}

export class SalesService {
  constructor(private repo: SalesRepository = salesRepository) {}

  /**
   * Helper para verificar permisos RBAC
   */
  private checkPermission(context: SalesUserContext, permission: string): void {
    if (!context.permissions.includes(permission) && !context.permissions.includes('*')) {
      throw new Error(
        `Acceso denegado: El usuario "${context.userName}" no cuenta con el permiso requerido [${permission}].`
      )
    }
  }

  /**
   * Lista ventas con filtros, ordenamiento y paginación
   */
  async list(
    params: SaleFilterParams = {},
    user: SalesUserContext = DEFAULT_USER
  ): Promise<{
    items: Sale[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    this.checkPermission(user, 'sales.read')
    const validated = saleFilterSchema.parse(params)
    return this.repo.findFiltered(validated as SaleFilterParams)
  }

  /**
   * Obtiene todas las ventas
   */
  async getAll(user: SalesUserContext = DEFAULT_USER): Promise<Sale[]> {
    this.checkPermission(user, 'sales.read')
    return this.repo.findAll()
  }

  /**
   * Obtiene el detalle relacional completo de una venta
   */
  async getById(id: string, user: SalesUserContext = DEFAULT_USER): Promise<SaleDetail> {
    this.checkPermission(user, 'sales.read')
    const detail = await this.repo.getDetail(id)
    if (!detail) {
      throw new Error(`La venta con ID "${id}" no existe en el sistema.`)
    }
    return detail
  }

  /**
   * Obtiene estadísticas agregadas del módulo Ventas
   */
  async getSalesStats(user: SalesUserContext = DEFAULT_USER): Promise<SaleStats> {
    this.checkPermission(user, 'sales.read')
    return this.repo.getStats()
  }

  /**
   * Crea y procesa una nueva venta con validación de inventario, precios y Kardex
   */
  async create(
    dto: CreateSaleDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<Sale> {
    this.checkPermission(user, 'sales.create')

    // 1. Validación de esquema con Zod
    const validated = createSaleSchema.parse(dto)

    // 2. Obtener cliente y validar existencia
    const { data: rawCustomers } = await supabaseMock.from('customers').select()
    const allCustomers = (rawCustomers as unknown as Array<{
      id: string
      displayName: string
      documentNumber: string
      customerType: 'NATURAL' | 'COMPANY'
      category: string
      priceList: 'DEFAULT' | 'WHOLESALE' | 'VIP'
      creditLimit: number
      currentBalance: number
      status: string
    }>) || []
    const customer = allCustomers.find((c) => c.id === validated.customerId)
    if (!customer) {
      throw new Error(`El cliente seleccionado con ID "${validated.customerId}" no existe.`)
    }
    if (customer.status === 'INACTIVE') {
      throw new Error(`El cliente "${customer.displayName}" se encuentra inactivo. Active el cliente para registrar ventas.`)
    }

    // 3. Obtener bodega y validar existencia
    const { data: rawLocations } = await supabaseMock.from('locations').select()
    const allLocations = (rawLocations as unknown as Array<{
      id: string
      name: string
      code: string
      type: string
      status: string
    }>) || []
    const location = allLocations.find((l) => l.id === validated.locationId)
    if (!location) {
      throw new Error(`La bodega o punto de venta con ID "${validated.locationId}" no existe.`)
    }

    // 4. Obtener productos y stock disponible
    const { data: rawProducts } = await supabaseMock.from('products').select()
    const allProducts = (rawProducts as unknown as Array<any>) || []

    const { data: rawStock } = await supabaseMock.from('stock_levels').select()
    const allStock = (rawStock as unknown as Array<{
      productId: string
      locationId: string
      availableUnits: number
      quantity: number
    }>) || []

    const calculatedItems: SaleItem[] = []

    for (const rawItem of validated.items) {
      const product = allProducts.find((p) => p.id === rawItem.productId)
      if (!product) {
        throw new Error(`El producto con ID "${rawItem.productId}" no existe en el catálogo.`)
      }
      if (product.status !== 'ACTIVE') {
        throw new Error(`El producto "${product.name}" no está activo para venta.`)
      }

      // Validar stock disponible en la bodega
      const stockLevel = allStock.find(
        (s) => s.productId === rawItem.productId && s.locationId === validated.locationId
      )
      const availableUnits = stockLevel ? stockLevel.availableUnits : (product.availableUnits || 0)

      if (availableUnits < rawItem.quantity) {
        throw new Error(
          `Existencia insuficiente para el producto "${product.name}" en la bodega "${location.name}". Disponible: ${availableUnits} unidades, Solicitado: ${rawItem.quantity} unidades.`
        )
      }

      // Validar límites de descuento
      const requestedDiscount = rawItem.discountPercent || 0
      if (requestedDiscount > user.maxAllowedDiscountPercent) {
        if (!user.permissions.includes('sales.discount') && !user.permissions.includes('*')) {
          throw new Error(
            `El descuento del ${requestedDiscount}% aplicado a "${product.name}" excede su límite permitido (${user.maxAllowedDiscountPercent}%). Se requiere autorización de supervisor.`
          )
        }
      }

      // Calcular línea de venta en el servidor
      const calculatedLine = salesCalculationService.calculateLineItem(
        product,
        rawItem,
        customer.priceList
      )
      calculatedItems.push(calculatedLine)
    }

    // 5. Calcular totales consolidados
    const totals = salesCalculationService.calculateSaleTotals(calculatedItems)

    // 6. Validar cupo de crédito si el método de pago es CREDITO
    if (validated.paymentMethod === 'CREDITO') {
      const newTotalDebt = customer.currentBalance + totals.totalAmount
      if (customer.creditLimit > 0 && newTotalDebt > customer.creditLimit) {
        const formatMoney = (n: number) =>
          new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
        throw new Error(
          `La venta excede el cupo de crédito aprobado para "${customer.displayName}". Cupo: ${formatMoney(customer.creditLimit)}, Saldo actual: ${formatMoney(customer.currentBalance)}, Venta: ${formatMoney(totals.totalAmount)}.`
        )
      }
    }

    // 7. Generar código y objeto de venta
    const saleCodeNumber = Math.floor(1000 + Math.random() * 9000)
    const saleNumber = `VTA-${new Date().getFullYear()}-${saleCodeNumber}`
    const saleId = `sale-${Date.now().toString().slice(-6)}`

    const newSale: Sale = {
      id: saleId,
      saleNumber,
      customerId: customer.id,
      customerName: customer.displayName,
      customerDoc: customer.documentNumber,
      customerType: customer.customerType,
      customerCategory: customer.category,
      priceList: customer.priceList,
      locationId: location.id,
      locationName: location.name,
      sellerId: user.userId,
      sellerName: user.userName,
      date: new Date().toISOString(),
      items: calculatedItems,
      ...totals,
      paymentMethod: validated.paymentMethod,
      paymentStatus: validated.paymentMethod === 'CREDITO' ? 'PENDING' : 'PAID',
      status: validated.documentTypeToGenerate === 'FACTURA_POS' || validated.documentTypeToGenerate === 'FACTURA_ELECTRONICA'
        ? 'INVOICED'
        : 'CONFIRMED',
      documentType: validated.documentTypeToGenerate || 'FACTURA_POS',
      notes: validated.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 8. Guardar venta en base de datos
    const createdSale = await this.repo.create(newSale)

    // 9. Registrar movimientos de salida de inventario (SALE_OUT) para Kardex
    await this.repo.createInventoryMovements(createdSale, {
      userId: user.userId,
      userName: user.userName,
    })

    // 10. Si solicitó factura electrónica o POS inmediata
    if (
      validated.documentTypeToGenerate === 'FACTURA_ELECTRONICA' ||
      validated.documentTypeToGenerate === 'FACTURA_POS'
    ) {
      const { invoiceId, invoiceNumber } = await this.repo.generateInvoice(
        createdSale,
        validated.documentTypeToGenerate,
        { userId: user.userId, userName: user.userName }
      )
      createdSale.invoiceId = invoiceId
      createdSale.invoiceNumber = invoiceNumber
    } else if (validated.documentTypeToGenerate === 'REMISION') {
      const { remissionId, remissionNumber } = await this.repo.generateRemission(
        createdSale,
        { notes: `Remisión directa de venta ${createdSale.saleNumber}` },
        { userId: user.userId, userName: user.userName }
      )
      createdSale.remissionId = remissionId
      createdSale.remissionNumber = remissionNumber
    }

    // 11. Auditoría
    const formattedTotal = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(createdSale.totalAmount)

    await this.repo.logAudit({
      user: user.userName,
      action: 'CREACIÓN_VENTA',
      details: `Venta ${createdSale.saleNumber} registrada exitosamente por ${formattedTotal} para el cliente "${createdSale.customerName}". Bodega: "${createdSale.locationName}". Documento: ${createdSale.documentType}.`,
      entityId: createdSale.id,
      newValues: { ...createdSale },
    })

    return createdSale
  }

  /**
   * Anula una venta existente y revierte los movimientos de inventario en Kardex
   */
  async cancelSale(
    dto: CancelSaleDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<Sale> {
    this.checkPermission(user, 'sales.cancel')
    const validated = cancelSaleSchema.parse(dto)

    const sale = await this.repo.findById(validated.saleId)
    if (!sale) {
      throw new Error(`La venta con ID "${validated.saleId}" no existe.`)
    }

    if (sale.status === 'CANCELLED') {
      throw new Error(`La venta ${sale.saleNumber} ya se encuentra anulada.`)
    }

    // 1. Revertir inventario en Kardex
    await this.repo.reverseInventoryMovements(sale, validated.reason, {
      userId: user.userId,
      userName: user.userName,
    })

    // 2. Actualizar estado de la venta
    const updated = await this.repo.update(sale.id, {
      status: 'CANCELLED',
      cancellationReason: validated.reason,
      cancelledAt: new Date().toISOString(),
      cancelledBy: user.userName,
    })

    if (!updated) {
      throw new Error(`Error al anular la venta "${sale.saleNumber}".`)
    }

    // 3. Registrar en auditoría
    await this.repo.logAudit({
      user: user.userName,
      action: 'ANULACIÓN_VENTA',
      details: `Venta ${sale.saleNumber} anulada. Motivo: ${validated.reason}. Stock de ${sale.totalUnits} unidades revertido en Kardex.`,
      entityId: sale.id,
      oldValues: { status: sale.status },
      newValues: { status: 'CANCELLED', reason: validated.reason, cancelledBy: user.userName },
    })

    return updated
  }

  /**
   * Genera factura POS o Electrónica para una venta existente
   */
  async generateInvoiceForSale(
    dto: CreateInvoiceFromSaleDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<Sale> {
    this.checkPermission(user, 'sales.update')
    const validated = createInvoiceFromSaleSchema.parse(dto)

    const sale = await this.repo.findById(validated.saleId)
    if (!sale) {
      throw new Error(`La venta con ID "${validated.saleId}" no existe.`)
    }

    if (sale.invoiceId) {
      throw new Error(`La venta ${sale.saleNumber} ya posee una factura emitida (${sale.invoiceNumber}).`)
    }

    const { invoiceId, invoiceNumber } = await this.repo.generateInvoice(
      sale,
      validated.type,
      { userId: user.userId, userName: user.userName }
    )

    const updated = await this.repo.findById(sale.id)

    await this.repo.logAudit({
      user: user.userName,
      action: 'FACTURACIÓN_VENTA',
      details: `Factura ${invoiceNumber} (${validated.type}) generada para la venta ${sale.saleNumber}.`,
      entityId: sale.id,
      newValues: { invoiceId, invoiceNumber, documentType: validated.type },
    })

    return updated || sale
  }

  /**
   * Genera guía de remisión para una venta existente
   */
  async generateRemissionForSale(
    dto: CreateRemissionFromSaleDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<Sale> {
    this.checkPermission(user, 'sales.update')
    const validated = createRemissionFromSaleSchema.parse(dto)

    const sale = await this.repo.findById(validated.saleId)
    if (!sale) {
      throw new Error(`La venta con ID "${validated.saleId}" no existe.`)
    }

    const { remissionId, remissionNumber } = await this.repo.generateRemission(
      sale,
      validated,
      { userId: user.userId, userName: user.userName }
    )

    const updated = await this.repo.findById(sale.id)

    await this.repo.logAudit({
      user: user.userName,
      action: 'REMISIÓN_VENTA',
      details: `Remisión de despacho ${remissionNumber} generada para la venta ${sale.saleNumber}.`,
      entityId: sale.id,
      newValues: { remissionId, remissionNumber },
    })

    return updated || sale
  }

  /**
   * Procesa devoluciones parciales o totales de mercancía
   */
  async processReturn(
    dto: SaleReturnDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<Sale> {
    this.checkPermission(user, 'sales.return')
    const validated = saleReturnSchema.parse(dto)

    const sale = await this.repo.findById(validated.saleId)
    if (!sale) {
      throw new Error(`La venta con ID "${validated.saleId}" no existe.`)
    }

    const movements = (db.inventoryMovements as unknown) as Array<Record<string, unknown>>
    const stockLevels = (db.stockLevels as unknown) as Array<{
      productId: string
      locationId: string
      availableUnits: number
      quantity: number
    }>

    for (const returnItem of validated.items) {
      const saleLine = sale.items.find((i) => i.productId === returnItem.productId)
      if (!saleLine) {
        throw new Error(`El producto no pertenece a la venta original ${sale.saleNumber}.`)
      }
      if (returnItem.quantity > saleLine.quantity) {
        throw new Error(`La cantidad a devolver (${returnItem.quantity}) no puede superar la cantidad vendida (${saleLine.quantity}).`)
      }

      // Revertir inventario
      const stockEntry = stockLevels.find(
        (s) => s.productId === returnItem.productId && s.locationId === sale.locationId
      )
      const previousStock = stockEntry ? stockEntry.availableUnits : 10
      const resultingStock = previousStock + returnItem.quantity

      if (stockEntry) {
        stockEntry.quantity += returnItem.quantity
        stockEntry.availableUnits = resultingStock
      }

      movements.unshift({
        id: `mov-ret-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        movementNumber: `MOV-DEV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        createdAt: new Date().toISOString(),
        productId: returnItem.productId,
        productName: saleLine.productName,
        sku: saleLine.sku,
        barcode: saleLine.barcode,
        locationId: sale.locationId,
        locationName: sale.locationName,
        type: 'DEVOLUCION_VENTA',
        quantityIn: returnItem.quantity,
        quantityOut: 0,
        quantityDelta: returnItem.quantity,
        previousStock,
        resultingStock,
        unitCost: saleLine.unitCost,
        totalValue: saleLine.unitPrice * returnItem.quantity,
        sourceDocumentType: 'SALE_RETURN',
        sourceDocumentId: sale.id,
        sourceDocumentNumber: sale.saleNumber,
        userId: user.userId,
        userName: user.userName,
        notes: `Devolución de mercancía por venta ${sale.saleNumber}. Motivo: ${returnItem.reason}`,
      })
    }

    const updated = await this.repo.update(sale.id, {
      status: 'RETURNED',
      notes: sale.notes
        ? `${sale.notes} | Devolución procesada: ${validated.reason}`
        : `Devolución procesada: ${validated.reason}`,
    })

    await this.repo.logAudit({
      user: user.userName,
      action: 'DEVOLUCIÓN_VENTA',
      details: `Devolución de productos procesada para la venta ${sale.saleNumber}. Motivo: ${validated.reason}.`,
      entityId: sale.id,
      newValues: { status: 'RETURNED', returnDetails: validated },
    })

    return updated || sale
  }
}

export const salesService = new SalesService()
